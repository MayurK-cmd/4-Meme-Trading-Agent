"""
strategy.py — Gemini 2.5 Flash trading decisions for 4.meme memecoin trading.

This module has been adapted from Pacifica perpetual futures to 4.meme memecoin trading:
  - LONG/SHORT → BUY/SELL/HOLD
  - RSI, funding rate, basis spread → bonding curve %, holder concentration, launch age
  - Account balance checks → BNB wallet balance
  - Trailing stops → same concept but for spot tokens
"""

import os, json
from google import genai
from google.genai import types

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

SYSTEM_PROMPT = """
You are 4MemePilot — an autonomous AI trading agent specialised in meme tokens on the four.meme launchpad (BNB Smart Chain).

Your job is to analyse the signals below and decide whether to BUY, SELL, or HOLD a position in this token. You are optimising for short-to-medium term momentum trades (minutes to hours), not long-term holds.

Signal interpretation:
- Bonding curve progress:
    0-30%   → Early stage, high risk/reward, watch for momentum
    30-70%  → Momentum phase, best BUY window if social is strong
    70-95%  → Late stage, graduation pump potential but crowded
    100%    → Graduated to PancakeSwap, different dynamics

- Holder concentration (rug risk):
    LOW (<40%)    → Safe, distributed ownership
    MEDIUM (40-60%) → Some concentration risk
    HIGH (>60%)   → High rug risk, be cautious

- Launch age:
    <15 min  → Very new, sniper territory, extreme risk
    15-60 min → New, high risk/reward
    1-6 hours → Establishing, finding price discovery
    6-24 hours → Established, more stable
    >24 hours → Mature, either dead or proven

- Buy/sell pressure (1h):
    Ratio >3:1 → Strong buy pressure, momentum building
    Ratio 1.5-3 → Moderate buy pressure
    Ratio 0.67-1.5 → Neutral/balanced
    Ratio <0.67 → Sell pressure dominating

- Liquidity:
    <$3,000 → Very risky, may not be able to exit
    $3,000-$50,000 → Moderate, acceptable for small trades
    >$50,000 → Healthy, safe to trade

- Social sentiment (Elfa AI):
    Engagement score is NOT polarity — high engagement can be FUD or hype.
    Weight at most 20% of total decision.
    Trending rank <20 = strong social momentum.

Wallet rules:
- If available_bnb < order_size_bnb → HOLD (not enough balance).
- If available_bnb < 0.01 → always HOLD.
- Factor existing positions when sizing — don't overextend.

Sizing:
- size_pct 0.25 = weak signal / high risk, 0.5 = moderate, 0.75-1.0 = strong confluence
- Default to HOLD when signals conflict or confidence < 0.55
- If rug_risk_score > 50, reduce size by half or HOLD

Respond ONLY with valid JSON, no markdown:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0 to 1.0,
  "reasoning": "2-3 plain English sentences a non-expert can understand",
  "size_pct": 0.25 | 0.5 | 0.75 | 1.0
}
"""


def _response_text(response) -> str:
    t = getattr(response, "text", None)
    if t:
        return t.strip()
    cands = getattr(response, "candidates", None) or []
    if cands:
        parts = getattr(cands[0].content, "parts", None) or []
        if parts:
            return getattr(parts[0], "text", "").strip()
    return ""


def _normalize(raw: dict, market: dict) -> dict:
    action = str(raw.get("action", "HOLD")).upper()
    if action not in ("BUY", "SELL", "HOLD"):
        action = "HOLD"
    try:
        conf = float(raw.get("confidence", 0.5))
    except (TypeError, ValueError):
        conf = 0.5
    conf = max(0.0, min(1.0, conf))
    try:
        size = float(raw.get("size_pct", 0.5))
    except (TypeError, ValueError):
        size = 0.5
    size = min((0.25, 0.5, 0.75, 1.0), key=lambda x: abs(x - size))
    return {
        "action":     action,
        "confidence": conf,
        "reasoning":  str(raw.get("reasoning", "No reasoning provided.")),
        "size_pct":   size,
        "symbol":     market["symbol"],
        "address":    market["address"],
        "price_usd":  market["price_usd"],
    }


def _format_holdings(holdings: list) -> str:
    if not holdings:
        return "None"
    return ", ".join(
        f"{h['symbol']}: {h['amount']:.2f}"
        for h in holdings
        if h.get("amount", 0) > 0
    )


def decide(
    market: dict,
    sentiment: dict,
    wallet_context: dict = None,
    max_position_bnb: float = 0.1,
) -> dict:
    """
    wallet_context: {
        bnb_balance, token_holdings
    }
    max_position_bnb: from user config
    """
    # Pre-computed signal labels from market.py
    bonding_signal = market.get("bonding_signal", "unknown")
    holder_signal = market.get("holder_signal", "LOW")
    age_signal = market.get("age_signal", "unknown")
    buy_sell_signal = market.get("buy_sell_signal", "neutral")
    liq_signal = market.get("liquidity_signal", "unknown")

    # Raw values for display
    bonding_pct = market.get("bonding_curve_pct", 0)
    top10_pct = market.get("top10_holder_pct", 0)
    buy_sell_ratio = market.get("buy_sell_ratio", 1.0)
    launched_min = market.get("launched_min_ago", 0)
    liquidity = market.get("liquidity_usd", 0)
    rug_risk = market.get("rug_risk_score", 0)

    # Wallet section
    if wallet_context:
        bnb_balance = wallet_context.get("bnb_balance", 0)
        holdings = _format_holdings(wallet_context.get("token_holdings", []))
        wallet_section = f"""
Wallet state:
- BNB balance:        {bnb_balance:.4f} BNB
- Token holdings:     {holdings}
- Max order size:     {max_position_bnb:.4f} BNB
"""
    else:
        wallet_section = "Wallet state: unavailable\n"

    # Sentiment section
    sentiment_score = sentiment.get("sentiment_score", 0)
    mention_count = sentiment.get("mention_count", 0)
    trending_rank = sentiment.get("trending_score", 0)
    sentiment_summary = sentiment.get("summary", "No sentiment data")

    user_msg = f"""
Token: {market['symbol']} ({market['address']})

── PRICE & MARKET ──
  Price (BNB):        {market['price_bnb']:.10f} BNB
  Price (USD):        ${market['price_usd']:.8f}
  Market Cap:         ${market['market_cap_usd']:,.0f}
  24h Volume:         ${market['volume_24h_usd']:,.0f}
  Liquidity Pool:     ${liquidity:,.0f}  → {liq_signal}

── FOUR.MEME LAUNCH METRICS ──
  Launched:           {launched_min} minutes ago  → {age_signal}
  Bonding Curve Fill: {bonding_pct:.1f}%  → {bonding_signal}
  Holder Count:       {market['holder_count']} wallets
  Top-10 Holders:     {top10_pct:.1f}% of supply  → Concentration Risk: {holder_signal}
  Buy/Sell (1h):      {market['buy_count_1h']} buys / {market['sell_count_1h']} sells  → {buy_sell_signal}

── SOCIAL SENTIMENT (Elfa AI) ──
  Engagement Score:   {sentiment_score:.2f} / 1.0 (0=none, 1=very high)
  Mentions (24h):     {mention_count}
  Trending rank:      {trending_rank:.0f}/100
  Summary:            {sentiment_summary}

── RISK ASSESSMENT ──
  Rug Risk Score:     {rug_risk}/100  (0=safe, 100=extreme risk)
  Graduated:          {'Yes' if market.get('graduated') else 'No'}
  Graduation Soon:    {'Yes' if market.get('graduation_imminent') else 'No'}
  AI Creator:         {'Yes' if market.get('ai_creator') else 'No'}
  Anti-Sniper Fee:    {'Yes' if market.get('fee_plan') else 'No'}

{wallet_section}
What is your trading decision?
"""

    if not GEMINI_API_KEY:
        return _fallback(market, sentiment, wallet_context, max_position_bnb)

    try:
        client   = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_msg,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.25,
            ),
        )
        text = _response_text(response)
        if not text:
            raise ValueError("Empty response from Gemini")
        if "```" in text:
            parts = text.split("```")
            text  = parts[1] if len(parts) > 1 else text
            if text.startswith("json"):
                text = text[4:]
        return _normalize(json.loads(text.strip()), market)
    except Exception as e:
        print(f"[Strategy] Gemini failed for {market['symbol']}: {e} — using fallback")
        return _fallback(market, sentiment, wallet_context, max_position_bnb)


def _fallback(
    market: dict,
    sentiment: dict,
    wallet_context: dict = None,
    max_position_bnb: float = 0.1,
) -> dict:
    """
    Rule-based fallback for 4.meme memecoin trading.
    Uses pre-computed signal labels from market.py.
    """
    bonding_signal = market.get("bonding_signal", "unknown")
    holder_signal = market.get("holder_signal", "LOW")
    age_signal = market.get("age_signal", "unknown")
    buy_sell_signal = market.get("buy_sell_signal", "neutral")
    liq_signal = market.get("liquidity_signal", "unknown")

    bonding_pct = market.get("bonding_curve_pct", 0)
    top10_pct = market.get("top10_holder_pct", 0)
    buy_sell_ratio = market.get("buy_sell_ratio", 1.0)
    launched_min = market.get("launched_min_ago", 0)
    liquidity = market.get("liquidity_usd", 0)
    rug_risk = market.get("rug_risk_score", 0)

    sent_score = sentiment.get("sentiment_score", 0)
    trending_rank = sentiment.get("trending_score", 0)

    # Wallet check
    if wallet_context:
        bnb_balance = wallet_context.get("bnb_balance", 0)
        min_order = max_position_bnb * 0.25
        if bnb_balance < min_order:
            return {
                "action":     "HOLD",
                "confidence": 1.0,
                "reasoning":  f"Insufficient BNB balance — {bnb_balance:.4f} BNB available, minimum order is {min_order:.4f} BNB.",
                "size_pct":   0.0,
                "symbol":     market["symbol"],
                "address":    market["address"],
                "price_usd":  market["price_usd"],
            }

    # Scoring system
    buy_score  = 0
    sell_score = 0
    signals    = []

    # Bonding curve (max 3 points)
    if bonding_signal == "momentum_phase":
        buy_score += 3; signals.append("bonding curve in momentum phase (30-70%)")
    elif bonding_signal == "early_stage":
        buy_score += 1; signals.append("early bonding stage (high risk/reward)")
    elif bonding_signal == "graduation_soon":
        buy_score += 2; signals.append("near graduation (potential pump)")
    elif bonding_signal == "late_stage":
        buy_score += 1; signals.append("late stage (crowded)")

    # Holder concentration (risk modifier)
    if holder_signal == "HIGH":
        sell_score += 3; signals.append("high holder concentration risk")
    elif holder_signal == "MEDIUM":
        sell_score += 1; signals.append("moderate holder concentration")

    # Launch age
    if age_signal == "very_new":
        sell_score += 2; signals.append("very new token (<15 min, sniper risk)")
    elif age_signal == "new":
        buy_score += 1; signals.append("new token with room to grow")
    elif age_signal == "established":
        buy_score += 1; signals.append("established token (>6h)")

    # Buy/sell pressure
    if buy_sell_signal == "strong_buy_pressure":
        buy_score += 3; signals.append("strong buy pressure (>3:1 ratio)")
    elif buy_sell_signal == "moderate_buy_pressure":
        buy_score += 2; signals.append("moderate buy pressure")
    elif buy_sell_signal == "strong_sell_pressure":
        sell_score += 2; signals.append("sell pressure dominating")

    # Liquidity
    if liq_signal == "critical_low":
        sell_score += 2; signals.append("critically low liquidity")
    elif liq_signal == "low":
        sell_score += 1; signals.append("low liquidity")
    elif liq_signal == "healthy":
        buy_score += 1; signals.append("healthy liquidity")

    # Social sentiment
    if sent_score > 0.6:
        buy_score += 2; signals.append("high social engagement")
    elif sent_score > 0.3:
        buy_score += 1; signals.append("moderate social engagement")

    if trending_rank > 0 and trending_rank < 20:
        buy_score += 2; signals.append(f"trending rank #{int(trending_rank)}")

    # Rug risk override
    if rug_risk > 70:
        sell_score += 5; signals.append("extreme rug risk")
    elif rug_risk > 50:
        sell_score += 2; signals.append("elevated rug risk")

    # Decision threshold
    threshold = 4
    if buy_score >= threshold and buy_score > sell_score:
        action = "BUY"
        confidence = min(0.5 + (buy_score - threshold) * 0.08, 0.85)
        # Reduce size for high risk
        if rug_risk > 30:
            size_pct = 0.25 if buy_score < 6 else 0.5
        else:
            size_pct = 0.25 if buy_score < 5 else (0.5 if buy_score < 7 else 0.75)
    elif sell_score >= threshold and sell_score > buy_score:
        action = "SELL"
        confidence = min(0.5 + (sell_score - threshold) * 0.08, 0.85)
        size_pct = 0.25 if sell_score < 5 else (0.5 if sell_score < 7 else 0.75)
    else:
        action = "HOLD"
        confidence = 0.45
        size_pct = 0.0

    reasoning = f"[Fallback] {action}: " + (
        ", ".join(signals) if signals
        else f"No clear signal — bonding={bonding_signal}, holders={holder_signal}, age={age_signal}"
    )

    return {
        "action":     action,
        "confidence": round(confidence, 3),
        "reasoning":  reasoning,
        "size_pct":   size_pct,
        "symbol":     market["symbol"],
        "address":    market["address"],
        "price_usd":  market["price_usd"],
    }
