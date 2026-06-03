"""add ai tables, receipt upgrades, budget limits

Revision ID: a1b2c3d4e5f6
Revises: 2be88cc42b95
Create Date: 2026-06-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '2be88cc42b95'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    bind = op.get_bind()
    insp = inspect(bind)
    columns = [col["name"] for col in insp.get_columns(table_name)]
    return column_name in columns


def table_exists(table_name):
    bind = op.get_bind()
    insp = inspect(bind)
    return table_name in insp.get_table_names()


def upgrade() -> None:

    # ── Upgrade receipts table — skip if column already exists ─────────────
    if not column_exists("receipts", "user_id"):
        op.add_column("receipts", sa.Column("user_id", sa.Integer(), nullable=True))
    if not column_exists("receipts", "merchant"):
        op.add_column("receipts", sa.Column("merchant", sa.String(), nullable=True))
    if not column_exists("receipts", "date"):
        op.add_column("receipts", sa.Column("date", sa.DateTime(), nullable=True))
    if not column_exists("receipts", "created_at"):
        op.add_column("receipts", sa.Column("created_at", sa.DateTime(), nullable=True))

    # ── Create ai_insights table ───────────────────────────────────────────
    if not table_exists("ai_insights"):
        op.create_table(
            "ai_insights",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("month", sa.Integer(), nullable=False),
            sa.Column("year", sa.Integer(), nullable=False),
            sa.Column("insights", sa.JSON(), nullable=False),
            sa.Column("total_spent", sa.Float(), nullable=True),
            sa.Column("top_category", sa.String(100), nullable=True),
            sa.Column("expense_count", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_ai_insights_user_id", "ai_insights", ["user_id"])

    # ── Create ai_predictions table ────────────────────────────────────────
    if not table_exists("ai_predictions"):
        op.create_table(
            "ai_predictions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("month", sa.Integer(), nullable=False),
            sa.Column("year", sa.Integer(), nullable=False),
            sa.Column("predicted_total", sa.Float(), nullable=True),
            sa.Column("confidence", sa.String(20), nullable=True),
            sa.Column("summary", sa.Text(), nullable=True),
            sa.Column("breakdown", sa.JSON(), nullable=True),
            sa.Column("days_elapsed", sa.Integer(), nullable=True),
            sa.Column("days_in_month", sa.Integer(), nullable=True),
            sa.Column("total_spent_so_far", sa.Float(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_ai_predictions_user_id", "ai_predictions", ["user_id"])

    # ── Create budget_limits table ─────────────────────────────────────────
    if not table_exists("budget_limits"):
        op.create_table(
            "budget_limits",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("category", sa.String(100), nullable=False),
            sa.Column("monthly_limit", sa.Float(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_budget_limits_user_id", "budget_limits", ["user_id"])


def downgrade() -> None:
    if table_exists("budget_limits"):
        op.drop_table("budget_limits")
    if table_exists("ai_predictions"):
        op.drop_table("ai_predictions")
    if table_exists("ai_insights"):
        op.drop_table("ai_insights")

    if column_exists("receipts", "created_at"):
        op.drop_column("receipts", "created_at")
    if column_exists("receipts", "date"):
        op.drop_column("receipts", "date")
    if column_exists("receipts", "merchant"):
        op.drop_column("receipts", "merchant")
    if column_exists("receipts", "user_id"):
        op.drop_column("receipts", "user_id")