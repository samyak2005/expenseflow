from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from app.models.enums import Category, ClaimStatus, Department


def check_not_future(value: date) -> date:
    # One day of slack: just after midnight IST, the date is still a day behind in UTC.
    if value > date.today() + timedelta(days=1):
        raise ValueError("expense_date cannot be in the future")
    return value


Money = Annotated[Decimal, Field(gt=0, le=1_000_000, max_digits=12, decimal_places=2)]
ExpenseDate = Annotated[date, AfterValidator(check_not_future)]


class ClaimCreate(BaseModel):
    employee_name: str = Field(min_length=2, max_length=120)
    department: Department
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: Category
    amount: Money
    expense_date: ExpenseDate


class ClaimUpdate(BaseModel):
    employee_name: str | None = Field(default=None, min_length=2, max_length=120)
    department: Department | None = None
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    category: Category | None = None
    amount: Money | None = None
    expense_date: ExpenseDate | None = None


class StatusChange(BaseModel):
    status: Literal[ClaimStatus.APPROVED, ClaimStatus.REJECTED, ClaimStatus.REIMBURSED]
    reviewer_comment: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def rejection_needs_reason(self) -> "StatusChange":
        if self.status == ClaimStatus.REJECTED and len(self.reviewer_comment.strip()) < 3:
            raise ValueError("a rejection needs a reviewer_comment explaining why")
        return self


class ClaimFilters(BaseModel):
    status: ClaimStatus | None = None
    category: Category | None = None
    department: Department | None = None
    q: str | None = Field(default=None, max_length=100)
    limit: int = Field(default=100, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class ClaimOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_name: str
    department: Department
    title: str
    description: str
    category: Category
    amount: float
    expense_date: date
    status: ClaimStatus
    reviewer_comment: str
    created_at: datetime
    updated_at: datetime


class CategoryStat(BaseModel):
    category: Category
    count: int
    amount: float


class ClaimStats(BaseModel):
    total_claims: int
    pending_count: int
    approved_count: int
    rejected_count: int
    reimbursed_count: int
    pending_amount: float
    approved_amount: float
    reimbursed_amount: float
    by_category: list[CategoryStat]
