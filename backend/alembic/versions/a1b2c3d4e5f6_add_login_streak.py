"""Add login_streak and best_login_streak to users

Revision ID: a1b2c3d4e5f6
Revises: f3a1b2c4d5e6
Create Date: 2026-04-06 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f3a1b2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('login_streak', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('best_login_streak', sa.Integer(), nullable=True, server_default='0'))


def downgrade() -> None:
    op.drop_column('users', 'best_login_streak')
    op.drop_column('users', 'login_streak')
