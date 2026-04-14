"""
logger.py — Posts 4.meme trading decisions to backend.

Streams every log line to /api/logs. Falls back to local file when backend is down.
Logs BUY/SELL/HOLD decisions with 4.meme-specific metrics.
"""

import json, os, sys, requests
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_URL   = os.getenv("BACKEND_URL", "http://localhost:3001")
AGENT_API_KEY = os.getenv("AGENT_API_SECRET", "")
USER_ID       = os.getenv("USER_ID", "")  # Auto-fetched if empty
DRY_RUN       = os.getenv("DRY_RUN", "true").lower() == "true"
LOG_FILE      = os.path.join(os.path.dirname(__file__), "..", "trades.json")

_cycles = 0


def _fetch_user_id() -> str:
    """Fetch userId from backend on first run."""
    try:
        r = requests.get(
            f"{BACKEND_URL}/api/agent/user-id",
            headers=_auth_headers(),
            timeout=5,
        )
        r.raise_for_status()
        return r.json().get("userId", "")
    except Exception as e:
        push_log(f"[Logger] Failed to fetch userId: {e}")
        return ""


def _auth_headers() -> dict:
    h = {"Content-Type": "application/json"}
    if AGENT_API_KEY:
        h["x-agent-key"] = AGENT_API_KEY
    return h


def push_log(line: str):
    """Push a single log line to backend (non-blocking best-effort)."""
    print(line)  # always print to stdout too
    try:
        requests.post(
            f"{BACKEND_URL}/api/logs",
            json={"line": line},
            headers=_auth_headers(),
            timeout=2,
        )
    except Exception:
        pass  # never block agent on log failure


def _load_fallback() -> list:
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return []


def _save_fallback(trades: list):
    try:
        with open(LOG_FILE, "w") as f:
            json.dump(trades[:500], f, indent=2)
    except Exception as e:
        push_log(f"[Logger] File fallback failed: {e}")


def log_decision(
    decision: dict,
    market: dict,
    sentiment: dict,
    order_result: dict = None,
    pnl_usdc: float = None,
):
    """Log a trading decision to backend (or file fallback)."""
    global USER_ID
    if not USER_ID:
        USER_ID = _fetch_user_id()

    payload = {
        "userId":           USER_ID,
        "symbol":           decision["symbol"],
        "token_address":    decision.get("address", market.get("address", "")),
        "action":           decision["action"],
        "confidence":       decision["confidence"],
        "reasoning":        decision["reasoning"],
        "size_pct":         decision.get("size_pct", 0),
        "price_usd":        decision.get("price_usd", market.get("price_usd")),
        # 4.meme specific metrics
        "bonding_curve_pct": market.get("bonding_curve_pct"),
        "liquidity_usd":     market.get("liquidity_usd"),
        "holder_count":      market.get("holder_count"),
        "rug_risk_score":    market.get("rug_risk_score"),
        # Sentiment
        "sentiment_score":   sentiment.get("sentiment_score"),
        "mention_count":     sentiment.get("mention_count"),
        "trending_score":    sentiment.get("trending_score"),
        # Order result
        "order":            order_result,
        "dry_run":          DRY_RUN,
        "pnl_usdc":         pnl_usdc,
    }

    posted = False
    try:
        r = requests.post(
            f"{BACKEND_URL}/api/trades",
            json=payload,
            headers=_auth_headers(),
            timeout=5,
        )
        r.raise_for_status()
        posted = True
    except Exception as e:
        push_log(f"[Logger] Backend unreachable, using file fallback: {e}")
        trades = _load_fallback()
        trades.insert(0, {**payload, "timestamp": datetime.now(timezone.utc).isoformat()})
        _save_fallback(trades)

    # Format log line
    ac = {
        "BUY":  "[BUY ]",
        "SELL": "[SELL]",
        "HOLD": "[HOLD]",
    }.get(decision["action"], "[?]")

    pnl_s = f"PnL: ${pnl_usdc:.4f}" if pnl_usdc is not None else ""
    bc = f"BC: {market.get('bonding_curve_pct', 0):.1f}%"
    liq = f"Liq: ${market.get('liquidity_usd', 0):,.0f}"

    push_log(
        f"{ac}  {decision['symbol']} @ ${decision.get('price_usd', 0):.8f}  "
        f"Conf: {decision['confidence']:.0%}  {bc}  {liq}  "
        f"{pnl_s}  {'OK' if posted else 'FALLBACK'}"
    )
    push_log(f"  {decision['reasoning'][:150]}")

    return payload


def send_heartbeat(symbol: str = None, error: str = None):
    """Send heartbeat to backend to show agent is alive."""
    global _cycles
    _cycles += 1
    try:
        requests.post(
            f"{BACKEND_URL}/api/agent/heartbeat",
            json={"symbol": symbol, "cyclesCompleted": _cycles, "error": error},
            headers=_auth_headers(),
            timeout=3,
        )
    except Exception:
        pass


def get_recent_trades(limit: int = 50) -> list:
    """Fetch recent trades from backend or file fallback."""
    try:
        r = requests.get(f"{BACKEND_URL}/api/trades", params={"limit": limit}, timeout=5)
        r.raise_for_status()
        return r.json().get("trades", [])
    except Exception:
        return _load_fallback()[:limit]
