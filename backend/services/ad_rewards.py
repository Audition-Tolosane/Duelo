"""Centralised gate for 'rewarded ad' rewards.

SECURITY: the reward endpoints (boost activate/refresh, mission double/reroll,
streak restore) currently grant their reward on the client's *claim* that a
rewarded ad was watched. There is no cryptographic proof of the ad view yet.

This gate is the single chokepoint where that proof should be enforced. Until
rewarded ads are integrated it (a) records every claim for audit, and
(b) throttles claims that arrive faster than a human could plausibly watch an
ad, which blocks trivial scripted spamming.

When AdMob (or another network) ships, plug the Server-Side Verification (SSV)
callback check into `verify_ad_reward` — verify the signed transaction instead
of trusting the bare client call.
"""
import logging
import time
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Minimum seconds between two ad-reward claims of the same action by one user.
# A rewarded ad runs ~15-30s; anything faster is almost certainly scripted.
# NOTE: in-memory, per-process — fine on a single instance, move to Redis if
# the backend is ever scaled horizontally (same caveat as rate_limit.py).
_MIN_INTERVAL_S = 8
_last_claim: dict[str, float] = {}


def verify_ad_reward(user_id: str, action: str) -> None:
    """Validate an 'ad watched' reward claim. Raises 429 if implausibly fast.

    # TODO(ads): once rewarded ads ship, verify the AdMob SSV signature here
    # (transaction_id + signature) before allowing the reward, instead of
    # trusting that the client really watched an ad.
    """
    key = f"{user_id}:{action}"
    now = time.time()
    last = _last_claim.get(key, 0.0)
    if now - last < _MIN_INTERVAL_S:
        logger.warning(
            f"[ad_reward] throttled action={action} user={user_id} "
            f"({now - last:.1f}s since last claim)"
        )
        raise HTTPException(status_code=429, detail="Trop rapide — patiente quelques secondes.")
    _last_claim[key] = now
    logger.info(f"[ad_reward] granted action={action} user={user_id}")
