# strategy.py — Gemini prompt for four.meme meme token trading
# Replace your existing build_prompt() function with this one.
# Drop this into agent/strategy.py

import json

def build_prompt(token: dict, sentiment: dict, market: dict) -> str:
    """
    Build the Gemini prompt for a four.meme meme token trading decision.

    Args:
        token: dict with keys:
            symbol          str   e.g. "PEPE"
            address         str   BSC contract address
            price_bnb       float current price in BNB
            price_usd       float current price in USD
            market_cap_usd  float
            volume_24h_usd  float
            holder_count    int   current unique holders
            bonding_curve_pct float  0–100, four.meme bonding curve fill %
            launched_min_ago  int  minutes since token launched
            liquidity_usd   float  current liquidity pool size
            top10_holder_pct float  % of supply held by top 10 wallets (rug risk)
            buy_count_1h    int   number of buy txns in last 1 hour
            sell_count_1h   int   number of sell txns in last 1 hour

        sentiment: dict with keys (from Elfa AI):
            mention_count_24h   int
            engagement_score    float  0–10000
            is_trending         bool
            trending_rank       int or None
            sentiment_label     str   "bullish" | "neutral" | "bearish"

        market: dict with keys:
            bnb_price_usd   float  current BNB price for context
            bnb_24h_change  float  BNB % change in 24h
    """

    top10_risk = "HIGH" if token["top10_holder_pct"] > 60 else \
                 "MEDIUM" if token["top10_holder_pct"] > 40 else "LOW"

    buy_sell_ratio = (
        f"{token['buy_count_1h']} buys / {token['sell_count_1h']} sells"
        if token["sell_count_1h"] > 0
        else f"{token['buy_count_1h']} buys / 0 sells"
    )

    trending_str = (
        f"YES — ranked #{sentiment['trending_rank']} on Elfa"
        if sentiment["is_trending"] else "No"
    )

    prompt = f"""You are an autonomous AI trading agent specialised in meme tokens on the four.meme launchpad (BNB Smart Chain).

Your job is to analyse the signals below and decide whether to BUY, SELL, or HOLD a position in this token. You are optimising for short-to-medium term momentum trades (minutes to hours), not long-term holds.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOKEN: {token['symbol']} ({token['address']})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

── PRICE & MARKET ──
  Price (BNB):        {token['price_bnb']:.10f} BNB
  Price (USD):        ${token['price_usd']:.8f}
  Market Cap:         ${token['market_cap_usd']:,.0f}
  24h Volume:         ${token['volume_24h_usd']:,.0f}
  Liquidity Pool:     ${token['liquidity_usd']:,.0f}

── FOUR.MEME LAUNCH METRICS ──
  Launched:           {token['launched_min_ago']} minutes ago
  Bonding Curve Fill: {token['bonding_curve_pct']:.1f}%  (100% = graduates to PancakeSwap)
  Holder Count:       {token['holder_count']} wallets
  Top-10 Holders:     {token['top10_holder_pct']:.1f}% of supply  → Concentration Risk: {top10_risk}
  Buy/Sell (1h):      {buy_sell_ratio}

── SOCIAL SENTIMENT (Elfa AI) ──
  24h Mentions:       {sentiment['mention_count_24h']}
  Engagement Score:   {sentiment['engagement_score']:.0f} / 10000
  Trending:           {trending_str}
  Sentiment:          {sentiment['sentiment_label'].upper()}

── MARKET CONTEXT ──
  BNB Price:          ${market['bnb_price_usd']:,.2f}  ({market['bnb_24h_change']:+.2f}% 24h)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SIGNAL INTERPRETATION GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bonding curve:
  - 0–30%   → Early stage, high risk/reward, watch for momentum
  - 30–70%  → Mid-stage, momentum phase — best BUY window if social is strong
  - 70–95%  → Late-stage, graduation pump potential but crowded
  - 100%    → Graduated to PancakeSwap, different dynamics

Rug risk indicators (be cautious or HOLD/SELL if multiple are present):
  - Top-10 wallets hold >60% of supply
  - Launched <10 minutes ago with very low holder count
  - Sell/Buy ratio >2:1 in 1h
  - Liquidity <$5,000

Momentum signals (favour BUY if several align):
  - Elfa trending + engagement score >5000
  - Mention count growing rapidly (>100 in 24h for new token)
  - Buy/sell ratio >3:1 in 1h
  - Bonding curve filling rapidly (30–80% range)
  - Holder count growing fast relative to launch time

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR RESPONSE — reply with ONLY valid JSON, no markdown, no extra text:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": <integer 0–100>,
  "size_pct": <25 | 50 | 75 | 100>,
  "reasoning": "<2-3 sentences explaining your decision, referencing specific signals above>",
  "primary_signal": "<the single most important signal driving your decision>",
  "risk_flags": ["<any rug or reversal risks you identified, empty list if none>"]
}}

Rules:
- If confidence < 50, always output HOLD regardless of action
- If top-10 concentration is HIGH AND launched_min_ago < 15, output HOLD
- size_pct should reflect conviction: 25 = low conviction, 100 = very high
- reasoning must be specific — reference actual numbers from the signals above
- Do not recommend BUY if liquidity_usd < 3000
"""

    return prompt


def parse_gemini_response(response_text: str) -> dict:
    """
    Parse Gemini's JSON response into a structured decision dict.
    Falls back to HOLD if parsing fails.
    """
    try:
        # Strip any accidental markdown fences
        clean = response_text.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        clean = clean.strip()

        data = json.loads(clean)

        action = data.get("action", "HOLD").upper()
        if action not in ("BUY", "SELL", "HOLD"):
            action = "HOLD"

        confidence = int(data.get("confidence", 0))
        if confidence < 50:
            action = "HOLD"

        return {
            "action":         action,
            "confidence":     confidence,
            "size_pct":       int(data.get("size_pct", 25)),
            "reasoning":      data.get("reasoning", "No reasoning provided."),
            "primary_signal": data.get("primary_signal", ""),
            "risk_flags":     data.get("risk_flags", []),
        }

    except Exception as e:
        print(f"[strategy] Failed to parse Gemini response: {e}\nRaw: {response_text}")
        return {
            "action":         "HOLD",
            "confidence":     0,
            "size_pct":       0,
            "reasoning":      "Gemini response parse error — defaulting to HOLD.",
            "primary_signal": "parse_error",
            "risk_flags":     ["parse_error"],
        }