"""
sentiment.py — Elfa AI sentiment for 4.meme memecoin trading.

This module fetches social sentiment data from Elfa AI for memecoin tokens.
Key concepts:
  - sentiment_score = engagement STRENGTH (0-1), not polarity
  - High engagement can be FUD or hype — use as confirmation only
  - Trending rank shows social momentum
"""

import os, time, math, requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

ELFA_API_KEY  = os.getenv("ELFA_API_KEY", "")
ELFA_BASE_URL = "https://api.elfa.ai"


def _elfa_get(path: str, params: dict = None, retries: int = 3) -> dict:
    """Call Elfa API with retry logic."""
    headers = {"x-elfa-api-key": ELFA_API_KEY}
    url     = f"{ELFA_BASE_URL}{path}"
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            wait = 2 ** attempt
            print(f"[Elfa] {path} attempt {attempt+1}/{retries} failed: {e}. Waiting {wait}s...")
            time.sleep(wait)
    return {}


def _unwrap(response) -> list:
    """Extract data list from API response."""
    if isinstance(response, dict):
        data = response.get("data", [])
        return data if isinstance(data, list) else []
    if isinstance(response, list):
        return response
    return []


def get_token_sentiment(symbol: str) -> dict:
    """
    Fetch Elfa AI sentiment for a memecoin token.

    Returns:
      sentiment_score: 0.0-1.0 — engagement STRENGTH (high = lots of quality activity)
      mention_count:   int — number of quality mentions in 24h
      trending_score:  0-100 rank-based (100 = #1 trending)
      engagement_note: plain English interpretation
      summary:         full summary string
    """
    if not ELFA_API_KEY:
        return _mock(symbol)

    mention_count   = 0
    engagement_score = 0.0
    trending_score  = 0.0

    # 1. Top mentions → engagement strength
    try:
        raw      = _elfa_get("/v2/data/top-mentions", params={"ticker": symbol, "timeWindow": "24h", "limit": 20})
        mentions = _unwrap(raw)
        mention_count = len(mentions)

        if mentions:
            scores = []
            for m in mentions:
                likes   = float(m.get("like_count",   0) or 0)
                reposts = float(m.get("repost_count", 0) or 0)
                replies = float(m.get("reply_count",  0) or 0)
                views   = float(m.get("view_count",   1) or 1)

                raw_eng = likes + reposts * 2 + replies
                if raw_eng > 0:
                    # Log-scale ratio avoids view-count crushing
                    ratio = math.log1p(raw_eng) / max(math.log1p(views), 1)
                    scores.append(min(ratio / 0.5, 1.0))
                else:
                    scores.append(0.0)

            engagement_score = round(sum(scores) / len(scores), 4)
    except Exception as e:
        print(f"[Elfa] top-mentions failed for {symbol}: {e}")

    # 2. Trending tokens → rank-based score
    try:
        raw    = _elfa_get("/v2/aggregations/trending-tokens", params={"timeWindow": "24h", "pageSize": 100})
        tokens = _unwrap(raw)
        found  = False

        for rank_0, item in enumerate(tokens):
            if not isinstance(item, dict):
                continue
            token_obj = item.get("token", item)
            sym = str(token_obj.get("symbol", "") or item.get("ticker", "")).upper().lstrip("$")
            if sym == symbol.upper():
                trending_score = round(max(0.0, 100 - rank_0 * 1.0), 1)
                if mention_count == 0:
                    mention_count = int(item.get("count", 0) or item.get("mentionCount", 0) or 0)
                found = True
                break

        if not found:
            # Baseline from mention count
            trending_score = 40.0 if mention_count >= 15 else (20.0 if mention_count >= 5 else 5.0)
    except Exception as e:
        print(f"[Elfa] trending-tokens failed for {symbol}: {e}")

    # Engagement note — what the score actually means
    if engagement_score > 0.6:
        eng_note = "very high engagement activity"
    elif engagement_score > 0.3:
        eng_note = "moderate engagement activity"
    elif engagement_score > 0.1:
        eng_note = "low engagement activity"
    else:
        eng_note = "minimal social activity"

    summary = (
        f"{symbol} shows {eng_note} (score {engagement_score:.2f}) with "
        f"{mention_count} quality mentions in 24h. "
        f"Trending rank score: {trending_score:.0f}/100. "
        f"Note: engagement strength is NOT price direction — use as confirmation only."
    )

    return {
        "symbol":          symbol,
        "sentiment_score": engagement_score,   # renamed conceptually — engagement strength
        "mention_count":   mention_count,
        "trending_score":  trending_score,
        "engagement_note": eng_note,
        "summary":         summary,
    }


def get_trending_tokens(limit: int = 20) -> list:
    """
    Fetch currently trending tokens from Elfa AI.
    Returns list of token symbols sorted by trending score.
    """
    if not ELFA_API_KEY:
        return []

    try:
        raw = _elfa_get("/v2/aggregations/trending-tokens", params={"timeWindow": "24h", "pageSize": limit})
        tokens = _unwrap(raw)

        result = []
        for item in tokens:
            if not isinstance(item, dict):
                continue
            token_obj = item.get("token", {})
            sym = str(token_obj.get("symbol", "")).upper().lstrip("$")
            if sym:
                result.append(sym)

        return result
    except Exception as e:
        print(f"[Elfa] Failed to fetch trending tokens: {e}")
        return []


def search_token_mentions(symbol: str, limit: int = 10) -> list:
    """
    Search for recent mentions of a token.
    Returns list of mention objects with content, likes, etc.
    """
    if not ELFA_API_KEY:
        return []

    try:
        raw = _elfa_get("/v2/data/top-mentions", params={"ticker": symbol, "timeWindow": "24h", "limit": limit})
        mentions = _unwrap(raw)
        return mentions
    except Exception as e:
        print(f"[Elfa] Failed to search mentions for {symbol}: {e}")
        return []


def _mock(symbol: str) -> dict:
    """Mock sentiment data when Elfa API key is not set."""
    return {
        "symbol":          symbol,
        "sentiment_score": 0.0,
        "mention_count":   0,
        "trending_score":  0.0,
        "engagement_note": "no Elfa API key set",
        "summary":         f"[Mock] Elfa API key not set — no sentiment data for {symbol}.",
    }
