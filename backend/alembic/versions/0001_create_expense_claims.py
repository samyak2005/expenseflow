"""create expense_claims table

Revision ID: 0001_create_expense_claims
Revises:
"""

import sqlalchemy as sa

from alembic import op

revision = "0001_create_expense_claims"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "expense_claims",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_name", sa.String(length=120), nullable=False),
        sa.Column("department", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("expense_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("reviewer_comment", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("amount > 0", name="ck_expense_claims_amount_positive"),
    )
    op.create_index("ix_expense_claims_status", "expense_claims", ["status"])


def downgrade():
    op.drop_index("ix_expense_claims_status", table_name="expense_claims")
    op.drop_table("expense_claims")
