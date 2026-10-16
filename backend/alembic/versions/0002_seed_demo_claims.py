"""seed demo claims

Revision ID: 0002_seed_demo_claims
Revises: 0001_create_expense_claims
"""

from datetime import date, timedelta

import sqlalchemy as sa

from alembic import op

revision = "0002_seed_demo_claims"
down_revision = "0001_create_expense_claims"
branch_labels = None
depends_on = None

claims = sa.table(
    "expense_claims",
    sa.column("employee_name", sa.String),
    sa.column("department", sa.String),
    sa.column("title", sa.String),
    sa.column("description", sa.Text),
    sa.column("category", sa.String),
    sa.column("amount", sa.Numeric),
    sa.column("expense_date", sa.Date),
    sa.column("status", sa.String),
    sa.column("reviewer_comment", sa.Text),
)

DEMO_CLAIMS = [
    (
        "Priya Sharma",
        "SALES",
        "Client visit to Mumbai - flight",
        "TRAVEL",
        8450,
        12,
        "REIMBURSED",
        "",
    ),
    (
        "Rahul Verma",
        "ENGINEERING",
        "JetBrains IDE annual licence",
        "SOFTWARE",
        6999,
        9,
        "APPROVED",
        "",
    ),
    (
        "Ananya Iyer",
        "MARKETING",
        "Team lunch after product launch",
        "MEALS",
        3200,
        6,
        "PENDING",
        "",
    ),
    (
        "Karan Mehta",
        "OPERATIONS",
        "Ergonomic keyboard and mouse",
        "EQUIPMENT",
        4599,
        5,
        "PENDING",
        "",
    ),
    (
        "Sneha Kapoor",
        "HR",
        "Hiring fair stall - cab fares",
        "TRAVEL",
        1260,
        4,
        "REJECTED",
        "Please attach the cab receipts and resubmit",
    ),
    (
        "Arjun Nair",
        "ENGINEERING",
        "Kubernetes certification exam",
        "TRAINING",
        32500,
        3,
        "PENDING",
        "",
    ),
    ("Meera Joshi", "FINANCE", "Tally Prime renewal", "SOFTWARE", 18000, 2, "APPROVED", ""),
    ("Vikram Singh", "SALES", "Dinner with Acme Corp procurement", "MEALS", 5400, 1, "PENDING", ""),
]


def upgrade():
    today = date.today()
    op.bulk_insert(
        claims,
        [
            {
                "employee_name": name,
                "department": dept,
                "title": title,
                "description": "",
                "category": category,
                "amount": amount,
                "expense_date": today - timedelta(days=days_ago),
                "status": status,
                "reviewer_comment": comment,
            }
            for name, dept, title, category, amount, days_ago, status, comment in DEMO_CLAIMS
        ],
    )


def downgrade():
    titles = [row[2] for row in DEMO_CLAIMS]
    op.execute(claims.delete().where(claims.c.title.in_(titles)))
