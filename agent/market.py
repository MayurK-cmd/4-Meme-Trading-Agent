"""
market.py — 4.meme memecoin market data with bonding curve analysis.

Replaces Pacifica-specific data with 4.meme memecoin metrics:
  - Bonding curve progress (0-100% to graduation)
  - Holder concentration (rug risk indicator)
  - Launch age, liquidity, volume
  - Buy/sell pressure (1h trade counts)
  - Social sentiment integration (Elfa AI)
"""

from __future__ import annotations
import os, time
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

import four_meme as fm

# ── Configuration ─────────────────────────────────────────────────────────────

# Bonding curve interpretation thresholds
EARLY_STAGE_PCT    = 30.0   # 0-30%: early stage, high risk/reward
MID_STAGE_PCT      = 70.0   # 30-70%: momentum phase, best buy window
LATE_STAGE_PCT     = 90.0   # 70-95%: late stage, graduation pump
GRADUATION_PCT     = 100.0  # 100%: graduated to PancakeSwap

# Rug risk thresholds
TOP10_HIGH_RISK_PCT    = 60.0  # Top 10 holders >60% = HIGH risk
TOP10_MEDIUM_RISK_PCT  = 40.0  # Top 10 holders >40% = MEDIUM risk

# Liquidity thresholds
MIN_LIQUIDITY_USD  = 3000.0   # Below this = risky
MIN_VOLUME_24H_USD = 10000.0  # Below this = low activity

# Circuit breaker for API failures
CIRCUIT_THRESH   = 5
CIRCUIT_COOLDOWN = 2

_fail_counts: dict[str, int] = {}
_skip_cycles: dict[str, int] = {}


# ── Circuit breaker ───────────────────────────────────────────────────────────

def _circuit_ok(key: str) -> bool:
    if _skip_cycles.get(key, 0) > 0:
        _skip_cycles[key] -= 1
        print(f"[Market] Circuit open for {key}, skipping ({_skip_cycles[key]} cycles left)")
        return False
    return True


def _record_fail(key: str):
    _fail_counts[key] = _fail_counts.get(key, 0) + 1
    if _fail_counts[key] >= CIRCUIT_THRESH:
        print(f"[Market] Circuit tripped for {key} after {CIRCUIT_THRESH} failures")
        _skip_cycles[key] = CIRCUIT_COOLDOWN
        _fail_counts[key] = 0


def _record_ok(key: str):
    _fail_counts[key] = 0


# ── Signal Computation ────────────────────────────────────────────────────────

def bonding_curve_signal(bonding_curve_pct: float) -> str:
    """
    Interpret bonding curve progress as a trading signal.
    """
    if bonding_curve_pct <= 0:
        return "not_started"
    if bonding_curve_pct < EARLY_STAGE_PCT:
        return "early_stage"       # High risk/reward, watch for momentum
    if bonding_curve_pct < MID_STAGE_PCT:
        return "momentum_phase"     # Best buy window if social is strong
    if bonding_curve_pct < LATE_STAGE_PCT:
        return "late_stage"         # Graduation pump potential but crowded
    if bonding_curve_pct < GRADUATION_PCT:
        return "graduation_soon"    # Near graduation, high volatility
    return "graduated"              # Different dynamics on PancakeSwap


def holder_concentration_signal(top10_holder_pct: float) -> str:
    """
    Assess rug risk from holder concentration.
    """
    if top10_holder_pct > TOP10_HIGH_RISK_PCT:
        return "HIGH"
    if top10_holder_pct > TOP10_MEDIUM_RISK_PCT:
        return "MEDIUM"
    return "LOW"


def buy_sell_pressure_signal(buy_count: int, sell_count: int) -> tuple[str, float]:
    """
    Calculate buy/sell pressure ratio.
    Returns (signal_label, ratio_value)
    """
    if sell_count == 0:
        if buy_count > 0:
            return("strong_buy_pressure", float('inf'))
        return "neutral", 1.0

    ratio = buy_count / sell_count

    if ratio >= 3.0:
        return "strong_buy_pressure", ratio
    if ratio >= 1.5:
        return "moderate_buy_pressure", ratio
    if ratio >= 0.67:
        return "neutral", ratio
    if ratio >= 0.33:
        return "moderate_sell_pressure", ratio
    return "strong_sell_pressure", ratio


def launch_age_signal(launched_min_ago: int) -> str:
    """
    Interpret token age for risk assessment.
    """
    if launched_min_ago < 15:
        return "very_new"       # Extremely high risk, sniper territory
    if launched_min_ago < 60:
        return "new"            # High risk/reward
    if launched_min_ago < 360:
        return "establishing"   # Finding price discovery
    if launched_min_ago < 1440:
        return "established"    # More stable
    return "mature"             # Either dead or proven


def liquidity_signal(liquidity_usd: float) -> str:
    """
    Assess liquidity adequacy.
    """
    if liquidity_usd < 1000:
        return "critical_low"
    if liquidity_usd < MIN_LIQUIDITY_USD:
        return "low"
    if liquidity_usd < 50000:
        return "moderate"
    if liquidity_usd < 200000:
        return "healthy"
    return "strong"


# ── Main Snapshot ─────────────────────────────────────────────────────────────

def get_market_snapshot(token_address: str) -> dict:
    """
    Fetch comprehensive market data for a 4.meme token.
    Combines API data with on-chain verification.
    """
    if not _circuit_ok(f"token_{token_address}"):
        return {"error": "circuit_open", "address": token_address}

    # 1. Fetch token data from 4.meme API
    token_data = fm.get_token_by_address(token_address)

    if not token_data or not token_data.get("address"):
        _record_fail(f"token_{token_address}")
        return {"error": "token_not_found", "address": token_address}

    _record_ok(f"token_{token_address}")

    # 2. Fetch bonding curve progress from on-chain (more reliable)
    bc_progress = fm.get_bonding_curve_progress(token_address)

    # 3. Compute signals
    bonding_signal = bonding_curve_signal(token_data["bonding_curve_pct"])
    holder_signal = holder_concentration_signal(token_data["top10_holder_pct"])
    buy_sell_signal, buy_sell_ratio = buy_sell_pressure_signal(
        token_data["buy_count_1h"],
        token_data["sell_count_1h"],
    )
    age_signal = launch_age_signal(token_data["launched_min_ago"])
    liq_signal = liquidity_signal(token_data["liquidity_usd"])

    # 4. Get BNB price for context
    bnb_price = fm.get_bnb_price_usd()

    # 5. Build snapshot dict (matches strategy.py expected format)
    return {
        # Token identity
        "symbol":              token_data["symbol"],
        "address":             token_data["address"],
        "name":                token_data["name"],

        # Price & market
        "price_bnb":           token_data["price_bnb"],
        "price_usd":           token_data["price_usd"],
        "market_cap_usd":      token_data["market_cap_usd"],
        "volume_24h_usd":      token_data["volume_24h_usd"],
        "liquidity_usd":       token_data["liquidity_usd"],

        # 4.meme launch metrics
        "launched_min_ago":    token_data["launched_min_ago"],
        "bonding_curve_pct":   token_data["bonding_curve_pct"],
        "holder_count":        token_data["holder_count"],
        "top10_holder_pct":    token_data["top10_holder_pct"],
        "buy_count_1h":        token_data["buy_count_1h"],
        "sell_count_1h":       token_data["sell_count_1h"],

        # Computed signals
        "bonding_signal":      bonding_signal,
        "holder_signal":       holder_signal,
        "buy_sell_signal":     buy_sell_signal,
        "buy_sell_ratio":      buy_sell_ratio,
        "age_signal":          age_signal,
        "liquidity_signal":    liq_signal,

        # 4.meme specific flags
        "version":             token_data["version"],
        "is_trending_4meme":   token_data["is_trending_4meme"],
        "trending_rank_4meme": token_data["trending_rank_4meme"],
        "fee_plan":            token_data["fee_plan"],  # AntiSniperFeeMode
        "ai_creator":          token_data["ai_creator"],
        "tax_info":            token_data["tax_info"],

        # Bonding curve details
        "graduated":           bc_progress.get("graduated", False),
        "graduation_imminent": bc_progress.get("graduation_imminent", False),
        "offers_sold":         bc_progress.get("offers_sold", 0),
        "offers_left":         bc_progress.get("offers_left", 0),
        "funds_raised_bnb":    bc_progress.get("funds_raised_bnb", 0),

        # Market context
        "bnb_price_usd":       bnb_price,

        # Rug risk flags (computed)
        "rug_risk_score": _calculate_rug_risk_score(token_data, bonding_signal, holder_signal, age_signal),
    }


def _calculate_rug_risk_score(token_data: dict, bonding_signal: str, holder_signal: str, age_signal: str) -> int:
    """
    Calculate a composite rug risk score (0-100).
    Higher = more risky.
    """
    score = 0

    # Holder concentration (max 40 points)
    if holder_signal == "HIGH":
        score += 40
    elif holder_signal == "MEDIUM":
        score += 20

    # Launch age (max 30 points)
    if age_signal == "very_new":
        score += 30
    elif age_signal == "new":
        score += 15

    # Liquidity (max 20 points)
    if token_data["liquidity_usd"] < 1000:
        score += 20
    elif token_data["liquidity_usd"] < 3000:
        score += 10

    # Bonding curve stage (max 10 points)
    if bonding_signal == "not_started":
        score += 10

    return min(score, 100)


def get_trending_tokens_snapshot(limit: int = 10) -> list:
    """
    Fetch market snapshots for trending 4.meme tokens.
    Returns list of snapshots sorted by trending score.
    """
    addresses = fm.get_trending_tokens(limit=limit)
    snapshots = []

    for addr in addresses:
        try:
            snapshot = get_market_snapshot(addr)
            if not snapshot.get("error"):
                snapshots.append(snapshot)
        except Exception as e:
            print(f"[Market] Failed to fetch snapshot for {addr}: {e}")

    return snapshots


def get_new_launches_snapshot(limit: int = 10) -> list:
    """
    Fetch market snapshots for newly launched tokens.
    Returns list of snapshots sorted by launch time (newest first).
    """
    addresses = fm.get_new_launches(limit=limit)
    snapshots = []

    for addr in addresses:
        try:
            snapshot = get_market_snapshot(addr)
            if not snapshot.get("error"):
                snapshots.append(snapshot)
        except Exception as e:
            print(f"[Market] Failed to fetch snapshot for {addr}: {e}")

    return snapshots


def scan_for_opportunities(
    min_liquidity: float = 5000,
    max_rug_risk: int = 50,
    bonding_curve_range: tuple = (20, 80),
) -> list:
    """
    Scan trending tokens for trading opportunities based on filters.

    Args:
        min_liquidity: Minimum liquidity in USD
        max_rug_risk: Maximum acceptable rug risk score (0-100)
        bonding_curve_range: (min_pct, max_pct) for bonding curve filter

    Returns:
        List of token snapshots matching criteria
    """
    snapshots = get_trending_tokens_snapshot(limit=20)
    opportunities = []

    for s in snapshots:
        # Filter by liquidity
        if s.get("liquidity_usd", 0) < min_liquidity:
            continue

        # Filter by rug risk
        if s.get("rug_risk_score", 100) > max_rug_risk:
            continue

        # Filter by bonding curve stage
        bc_pct = s.get("bonding_curve_pct", 0)
        if bc_pct < bonding_curve_range[0] or bc_pct > bonding_curve_range[1]:
            continue

        # Filter out graduated tokens (different dynamics)
        if s.get("graduated", False):
            continue

        opportunities.append(s)

    return opportunities
