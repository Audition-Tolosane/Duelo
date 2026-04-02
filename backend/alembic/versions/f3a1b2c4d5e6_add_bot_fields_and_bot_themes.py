"""Add bot fields to users and create bot_themes table

Revision ID: f3a1b2c4d5e6
Revises: cae4f6170747
Create Date: 2026-03-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a1b2c4d5e6'
down_revision: Union[str, None] = 'cae4f6170747'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Bot fields on users ────────────────────────────────────────────────────
    op.add_column('users', sa.Column('is_bot', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('skill_level', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('avg_speed', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('win_rate', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('language', sa.String(length=5), nullable=True))
    op.add_column('users', sa.Column('timezone', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('preferred_hours', sa.JSON(), nullable=True))

    op.create_index('ix_users_is_bot', 'users', ['is_bot'], unique=False)

    # ── bot_themes table ───────────────────────────────────────────────────────
    op.create_table(
        'bot_themes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('bot_pseudo', sa.String(length=50), nullable=False),
        sa.Column('theme_id', sa.String(length=30), nullable=False),
        sa.Column('games_played_on_theme', sa.Integer(), nullable=True),
        sa.Column('win_rate_on_theme', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['bot_pseudo'], ['users.pseudo'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('bot_pseudo', 'theme_id', name='uq_bot_theme'),
    )
    op.create_index('ix_bot_themes_bot_pseudo', 'bot_themes', ['bot_pseudo'], unique=False)
    op.create_index('ix_bot_themes_theme_id', 'bot_themes', ['theme_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_bot_themes_theme_id', table_name='bot_themes')
    op.drop_index('ix_bot_themes_bot_pseudo', table_name='bot_themes')
    op.drop_table('bot_themes')

    op.drop_index('ix_users_is_bot', table_name='users')
    op.drop_column('users', 'preferred_hours')
    op.drop_column('users', 'timezone')
    op.drop_column('users', 'language')
    op.drop_column('users', 'win_rate')
    op.drop_column('users', 'avg_speed')
    op.drop_column('users', 'skill_level')
    op.drop_column('users', 'is_bot')
