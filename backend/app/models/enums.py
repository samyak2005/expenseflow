from enum import StrEnum


class ClaimStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REIMBURSED = "REIMBURSED"


class Category(StrEnum):
    TRAVEL = "TRAVEL"
    MEALS = "MEALS"
    SOFTWARE = "SOFTWARE"
    EQUIPMENT = "EQUIPMENT"
    TRAINING = "TRAINING"
    OTHER = "OTHER"


class Department(StrEnum):
    ENGINEERING = "ENGINEERING"
    SALES = "SALES"
    MARKETING = "MARKETING"
    HR = "HR"
    FINANCE = "FINANCE"
    OPERATIONS = "OPERATIONS"
