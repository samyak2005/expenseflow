from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .db import get_db
from .metrics import CLAIM_STATUS_CHANGES, CLAIMS_SUBMITTED
from .models import ExpenseClaim
from .schemas import (
    Category,
    CategoryStat,
    ClaimCreate,
    ClaimOut,
    ClaimUpdate,
    Department,
    StatsOut,
    Status,
    StatusChange,
)

router = APIRouter(prefix="/api/claims", tags=["claims"])

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "PENDING": {"APPROVED", "REJECTED"},
    "APPROVED": {"REIMBURSED"},
}

EDITABLE_STATUSES = {"PENDING"}
DELETABLE_STATUSES = {"PENDING", "REJECTED"}


def get_claim_or_404(claim_id: int, db: Session) -> ExpenseClaim:
    claim = db.get(ExpenseClaim, claim_id)
    if claim is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Claim not found")
    return claim


@router.get("", response_model=list[ClaimOut])
def list_claims(
    status_filter: Status | None = Query(default=None, alias="status"),
    category: Category | None = None,
    department: Department | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    query = select(ExpenseClaim).order_by(ExpenseClaim.id.desc())
    if status_filter:
        query = query.where(ExpenseClaim.status == status_filter)
    if category:
        query = query.where(ExpenseClaim.category == category)
    if department:
        query = query.where(ExpenseClaim.department == department)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(
            or_(ExpenseClaim.title.ilike(pattern), ExpenseClaim.employee_name.ilike(pattern))
        )
    return db.scalars(query).all()


@router.get("/stats", response_model=StatsOut)
def claim_stats(db: Session = Depends(get_db)):
    by_status = {
        row.status: row
        for row in db.execute(
            select(
                ExpenseClaim.status,
                func.count(ExpenseClaim.id).label("count"),
                func.coalesce(func.sum(ExpenseClaim.amount), 0).label("amount"),
            ).group_by(ExpenseClaim.status)
        )
    }

    def count(name: str) -> int:
        return by_status[name].count if name in by_status else 0

    def amount(name: str) -> float:
        return float(by_status[name].amount) if name in by_status else 0.0

    category_rows = db.execute(
        select(
            ExpenseClaim.category,
            func.count(ExpenseClaim.id),
            func.coalesce(func.sum(ExpenseClaim.amount), 0),
        )
        .where(ExpenseClaim.status != "REJECTED")
        .group_by(ExpenseClaim.category)
        .order_by(func.sum(ExpenseClaim.amount).desc())
    ).all()

    return StatsOut(
        total_claims=sum(row.count for row in by_status.values()),
        pending_count=count("PENDING"),
        approved_count=count("APPROVED"),
        rejected_count=count("REJECTED"),
        reimbursed_count=count("REIMBURSED"),
        pending_amount=amount("PENDING"),
        approved_amount=amount("APPROVED"),
        reimbursed_amount=amount("REIMBURSED"),
        by_category=[
            CategoryStat(category=cat, count=n, amount=float(total))
            for cat, n, total in category_rows
        ],
    )


@router.get("/{claim_id}", response_model=ClaimOut)
def get_claim(claim_id: int, db: Session = Depends(get_db)):
    return get_claim_or_404(claim_id, db)


@router.post("", response_model=ClaimOut, status_code=status.HTTP_201_CREATED)
def create_claim(payload: ClaimCreate, db: Session = Depends(get_db)):
    claim = ExpenseClaim(**payload.model_dump(), status="PENDING")
    db.add(claim)
    db.commit()
    db.refresh(claim)
    CLAIMS_SUBMITTED.labels(category=claim.category).inc()
    return claim


@router.put("/{claim_id}", response_model=ClaimOut)
def update_claim(claim_id: int, payload: ClaimUpdate, db: Session = Depends(get_db)):
    claim = get_claim_or_404(claim_id, db)
    if claim.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Only pending claims can be edited; this one is {claim.status}",
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(claim, field, value)
    db.commit()
    db.refresh(claim)
    return claim


@router.patch("/{claim_id}/status", response_model=ClaimOut)
def change_status(claim_id: int, payload: StatusChange, db: Session = Depends(get_db)):
    claim = get_claim_or_404(claim_id, db)
    if payload.status not in ALLOWED_TRANSITIONS.get(claim.status, set()):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"A {claim.status} claim cannot be moved to {payload.status}",
        )
    claim.status = payload.status
    if payload.reviewer_comment:
        claim.reviewer_comment = payload.reviewer_comment.strip()
    db.commit()
    db.refresh(claim)
    CLAIM_STATUS_CHANGES.labels(status=claim.status).inc()
    return claim


@router.delete("/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_claim(claim_id: int, db: Session = Depends(get_db)):
    claim = get_claim_or_404(claim_id, db)
    if claim.status not in DELETABLE_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"A {claim.status} claim is part of the audit trail and cannot be deleted",
        )
    db.delete(claim)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
