from datetime import date
from decimal import Decimal

import pytest

from app.core.errors import ClaimNotFoundError, ClaimStateError
from app.models import ClaimStatus
from app.schemas import ClaimCreate, ClaimFilters, ClaimUpdate, StatusChange
from app.services import claims as service


@pytest.fixture()
def new_claim(db):
    def _new(**overrides):
        data = {
            "employee_name": "Dev Patel",
            "department": "SALES",
            "title": "Client lunch",
            "category": "MEALS",
            "amount": Decimal("1800.00"),
            "expense_date": date.today(),
            **overrides,
        }
        return service.create_claim(db, ClaimCreate(**data))

    return _new


def approve(db, claim):
    return service.change_status(db, claim.id, StatusChange(status=ClaimStatus.APPROVED))


def test_every_allowed_transition_succeeds(db, new_claim):
    claim = new_claim()
    approve(db, claim)
    paid = service.change_status(db, claim.id, StatusChange(status=ClaimStatus.REIMBURSED))
    assert paid.status == ClaimStatus.REIMBURSED


@pytest.mark.parametrize(
    ("setup", "target"),
    [
        ([], ClaimStatus.REIMBURSED),
        ([ClaimStatus.APPROVED], ClaimStatus.REJECTED),
        ([ClaimStatus.APPROVED, ClaimStatus.REIMBURSED], ClaimStatus.APPROVED),
    ],
)
def test_disallowed_transitions_raise(db, new_claim, setup, target):
    claim = new_claim()
    for step in setup:
        service.change_status(db, claim.id, StatusChange(status=step))

    with pytest.raises(ClaimStateError):
        service.change_status(
            db, claim.id, StatusChange(status=target, reviewer_comment="not allowed")
        )


def test_update_is_blocked_once_approved(db, new_claim):
    claim = new_claim()
    approve(db, claim)
    with pytest.raises(ClaimStateError):
        service.update_claim(db, claim.id, ClaimUpdate(title="Changed later"))


def test_missing_claim_raises_not_found(db):
    with pytest.raises(ClaimNotFoundError):
        service.get_claim(db, 404)


def test_list_paginates_and_reports_total(db, new_claim):
    for i in range(5):
        new_claim(title=f"Claim {i}")

    page, total = service.list_claims(db, ClaimFilters(limit=2, offset=2))

    assert total == 5
    assert [c.title for c in page] == ["Claim 2", "Claim 1"]


def test_stats_exclude_rejected_spend(db, new_claim):
    kept = new_claim(category="TRAVEL", amount=Decimal("500"))
    rejected = new_claim(category="MEALS", amount=Decimal("900"))
    approve(db, kept)
    service.change_status(
        db, rejected.id, StatusChange(status=ClaimStatus.REJECTED, reviewer_comment="Personal")
    )

    stats = service.get_stats(db)

    assert stats.approved_amount == 500
    assert stats.rejected_count == 1
    assert [c.category for c in stats.by_category] == ["TRAVEL"]
