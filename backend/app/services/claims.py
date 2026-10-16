from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import ClaimNotFoundError, ClaimStateError
from app.core.metrics import CLAIM_STATUS_CHANGES, CLAIMS_SUBMITTED
from app.models import ClaimStatus, ExpenseClaim
from app.schemas import (
    CategoryStat,
    ClaimCreate,
    ClaimFilters,
    ClaimStats,
    ClaimUpdate,
    StatusChange,
)

ALLOWED_TRANSITIONS: dict[ClaimStatus, set[ClaimStatus]] = {
    ClaimStatus.PENDING: {ClaimStatus.APPROVED, ClaimStatus.REJECTED},
    ClaimStatus.APPROVED: {ClaimStatus.REIMBURSED},
}
EDITABLE_STATUSES = {ClaimStatus.PENDING}
DELETABLE_STATUSES = {ClaimStatus.PENDING, ClaimStatus.REJECTED}


def _filtered(query: Select, filters: ClaimFilters) -> Select:
    if filters.status:
        query = query.where(ExpenseClaim.status == filters.status)
    if filters.category:
        query = query.where(ExpenseClaim.category == filters.category)
    if filters.department:
        query = query.where(ExpenseClaim.department == filters.department)
    if filters.q and filters.q.strip():
        pattern = f"%{filters.q.strip()}%"
        query = query.where(
            or_(ExpenseClaim.title.ilike(pattern), ExpenseClaim.employee_name.ilike(pattern))
        )
    return query


def list_claims(db: Session, filters: ClaimFilters) -> tuple[list[ExpenseClaim], int]:
    total = db.scalar(_filtered(select(func.count(ExpenseClaim.id)), filters))
    claims = db.scalars(
        _filtered(select(ExpenseClaim), filters)
        .order_by(ExpenseClaim.id.desc())
        .limit(filters.limit)
        .offset(filters.offset)
    ).all()
    return list(claims), total or 0


def get_claim(db: Session, claim_id: int) -> ExpenseClaim:
    claim = db.get(ExpenseClaim, claim_id)
    if claim is None:
        raise ClaimNotFoundError(claim_id)
    return claim


def create_claim(db: Session, data: ClaimCreate) -> ExpenseClaim:
    claim = ExpenseClaim(**data.model_dump(), status=ClaimStatus.PENDING)
    db.add(claim)
    db.commit()
    db.refresh(claim)
    CLAIMS_SUBMITTED.labels(category=claim.category).inc()
    return claim


def update_claim(db: Session, claim_id: int, data: ClaimUpdate) -> ExpenseClaim:
    claim = get_claim(db, claim_id)
    if claim.status not in EDITABLE_STATUSES:
        raise ClaimStateError(f"Only pending claims can be edited; this one is {claim.status}")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(claim, field, value)
    db.commit()
    db.refresh(claim)
    return claim


def change_status(db: Session, claim_id: int, change: StatusChange) -> ExpenseClaim:
    claim = get_claim(db, claim_id)
    if change.status not in ALLOWED_TRANSITIONS.get(ClaimStatus(claim.status), set()):
        raise ClaimStateError(f"Cannot move a claim from {claim.status} to {change.status}")

    claim.status = change.status
    if change.reviewer_comment.strip():
        claim.reviewer_comment = change.reviewer_comment.strip()
    db.commit()
    db.refresh(claim)
    CLAIM_STATUS_CHANGES.labels(status=claim.status).inc()
    return claim


def delete_claim(db: Session, claim_id: int) -> None:
    claim = get_claim(db, claim_id)
    if claim.status not in DELETABLE_STATUSES:
        raise ClaimStateError(f"{claim.status} claims are kept for audit and cannot be deleted")
    db.delete(claim)
    db.commit()


def get_stats(db: Session) -> ClaimStats:
    rows = db.execute(
        select(
            ExpenseClaim.status,
            func.count(ExpenseClaim.id),
            func.coalesce(func.sum(ExpenseClaim.amount), 0),
        ).group_by(ExpenseClaim.status)
    ).all()
    counts = {status: count for status, count, _ in rows}
    amounts = {status: float(amount) for status, _, amount in rows}

    spend = db.execute(
        select(
            ExpenseClaim.category,
            func.count(ExpenseClaim.id),
            func.coalesce(func.sum(ExpenseClaim.amount), 0),
        )
        .where(ExpenseClaim.status != ClaimStatus.REJECTED)
        .group_by(ExpenseClaim.category)
        .order_by(func.sum(ExpenseClaim.amount).desc())
    ).all()

    return ClaimStats(
        total_claims=sum(counts.values()),
        pending_count=counts.get(ClaimStatus.PENDING, 0),
        approved_count=counts.get(ClaimStatus.APPROVED, 0),
        rejected_count=counts.get(ClaimStatus.REJECTED, 0),
        reimbursed_count=counts.get(ClaimStatus.REIMBURSED, 0),
        pending_amount=amounts.get(ClaimStatus.PENDING, 0.0),
        approved_amount=amounts.get(ClaimStatus.APPROVED, 0.0),
        reimbursed_amount=amounts.get(ClaimStatus.REIMBURSED, 0.0),
        by_category=[
            CategoryStat(category=category, count=count, amount=float(amount))
            for category, count, amount in spend
        ],
    )
