"""
main.py — 4MemePilot agent loop for 4.meme memecoin trading.

Adapted from PacificaPilot perpetual futures trading to 4.meme memecoin trading:
  - Scans trending/new tokens on 4.meme instead of fixed BTC/ETH
  - BUY/SELL spot tokens instead of LONG/SHORT perpetuals
  - BSC wallet balance instead of Pacifica account
  - Dry run mode for safe testing
"""

import os, time, requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

import market as mkt
import sentiment as snt
import strategy as strat
import executor as exe
import logger as log

# ── Configuration ─────────────────────────────────────────────────────────────

BACKEND_URL  = os.getenv("BACKEND_URL", "")
AGENT_SECRET = os.getenv("AGENT_API_SECRET", "")
DRY_RUN      = os.getenv("DRY_RUN", "true").lower() == "true"

# 4.meme specific config
SCAN_MODE    = os.getenv("SCAN_MODE", "trending")  # "trending" | "new" | "watchlist"
WATCHLIST    = os.getenv("WATCHLIST", "").split(",")  # Comma-separated token addresses

if not DRY_RUN:
    print("=" * 56)
    print("WARNING: LIVE MODE - Real BSC transactions will be executed!")
    print("=" * 56)
    time.sleep(3)


def _agent_headers() -> dict:
    return {"Content-Type": "application/json", "x-agent-key": AGENT_SECRET}


def fetch_config() -> dict | None:
    """Fetch trading config from backend (if available)."""
    try:
        r = requests.get(
            f"{BACKEND_URL}/api/agent/config",
            headers=_agent_headers(),
            timeout=5,
        )
        r.raise_for_status()
        return r.json()
    except requests.exceptions.ConnectionError:
        log.push_log("[Config] Backend is not running — using defaults. Retry in 30s...")
        return None
    except requests.exceptions.Timeout:
        log.push_log("[Config] Backend timed out — using defaults. Retry in 30s...")
        return None
    except requests.exceptions.HTTPError as e:
        log.push_log(f"[Config] Backend returned error {e.response.status_code} — using defaults.")
        return None
    except Exception as e:
        log.push_log(f"[Config] Unexpected error: {e} — using defaults.")
        return None


def get_default_config() -> dict:
    """Default config for 4.meme trading."""
    return {
        "maxPositionBnb":      float(os.getenv("MAX_POSITION_BNB", "0.1")),
        "maxPositionUsd":      float(os.getenv("MAX_POSITION_USD", "60")),
        "minConfidence":       float(os.getenv("MIN_CONFIDENCE", "0.55")),
        "stopLossPct":         float(os.getenv("STOP_LOSS_PCT", "5.0")),
        "takeProfitPct":       float(os.getenv("TAKE_PROFIT_PCT", "10.0")),
        "scanMode":            SCAN_MODE,
        "watchlist":           WATCHLIST,
        "maxOpenPositions":    int(os.getenv("MAX_OPEN_POSITIONS", "3")),
        "minLiquidityUsd":     float(os.getenv("MIN_LIQUIDITY_USD", "5000")),
        "maxRugRisk":          int(os.getenv("MAX_RUG_RISK", "50")),
        "bondingCurveRange":   (
            float(os.getenv("BC_MIN_PCT", "20")),
            float(os.getenv("BC_MAX_PCT", "80")),
        ),
    }


# ── Per-token logic (runs in thread pool) ────────────────────────────────────

def process_token(
    token_address: str,
    cfg: dict,
    wallet_context: dict,
    live_positions: dict,
) -> None:
    """
    All work for a single token. Safe to run concurrently.
    """
    max_pos_bnb = cfg["maxPositionBnb"]
    min_conf    = cfg["minConfidence"]
    stop_loss   = cfg["stopLossPct"]
    take_profit = cfg["takeProfitPct"]
    max_positions = cfg["maxOpenPositions"]

    try:
        # 1. Market data
        log.push_log(f"[Token] Fetching market data for {token_address[:8]}...")
        market = mkt.get_market_snapshot(token_address)

        if market.get("error"):
            log.push_log(f"[Token] Error fetching market data: {market.get('error')}")
            log.send_heartbeat(symbol=market.get("symbol", "UNKNOWN"))
            return

        symbol = market["symbol"]
        log.push_log(
            f"  {symbol}: ${market['price_usd']:.8f} | "
            f"BC: {market['bonding_curve_pct']:.1f}% ({market['bonding_signal']}) | "
            f"Liq: ${market['liquidity_usd']:,.0f} | "
            f"Risk: {market['rug_risk_score']}/100"
        )

        current_price = market["price_usd"]

        # 2. Check existing position for exit
        if exe.has_position(symbol):
            log.push_log(f"[Token] Have existing position for {symbol}, checking exit...")
            exit_triggered, exit_reason = exe.should_exit(
                symbol, current_price, stop_loss, take_profit
            )
            if exit_triggered:
                log.push_log(f"[Token] EXIT triggered: {exit_reason}")
                pnl = exe.compute_pnl(symbol, current_price)
                close_result = exe.close_position(symbol, reason=exit_reason)

                # Log to chain
                exe.log_decision_to_chain(
                    decision={
                        "action": "SELL", "confidence": 1.0,
                        "reasoning": f"Auto-exit: {exit_reason}",
                        "symbol": symbol, "address": token_address,
                    },
                    market=market,
                    sentiment={"sentiment_score": 0, "mention_count": 0, "trending_score": 0},
                    pnl_usdc=pnl,
                )

                log.log_decision(
                    decision={
                        "action": "SELL", "confidence": 1.0,
                        "reasoning": f"Auto-exit: {exit_reason}",
                        "size_pct": 0, "symbol": symbol, "price_usd": current_price,
                    },
                    market=market,
                    sentiment={"sentiment_score": 0, "mention_count": 0, "trending_score": 0, "summary": ""},
                    order_result=close_result,
                    pnl_usdc=pnl,
                )
                log.send_heartbeat(symbol=symbol)
                return

        # 3. Check if we're at max positions
        if len(live_positions) >= max_positions:
            log.push_log(f"[Token] At max positions ({max_positions}), skipping new entries")
            log.send_heartbeat(symbol=symbol)
            return

        # 4. Sentiment
        log.push_log(f"[Token] Fetching Elfa AI sentiment for {symbol}...")
        sentiment = snt.get_token_sentiment(symbol)
        log.push_log(
            f"  Engagement: {sentiment['sentiment_score']:.2f} | "
            f"Mentions: {sentiment['mention_count']} | "
            f"Trending: {sentiment['trending_score']:.0f}"
        )

        # 5. Strategy decision
        log.push_log(f"[Token] Asking Gemini for {symbol}...")
        decision = strat.decide(market, sentiment, wallet_context, max_pos_bnb)

        log.push_log(
            f"  Decision: {decision['action']} "
            f"(conf {decision['confidence']:.0%})"
        )
        log.push_log(f"  Reason: {decision['reasoning']}")

        # 6. Execute
        order_result = None
        pnl_usdc = exe.compute_pnl(symbol, current_price) if exe.has_position(symbol) else 0

        if decision["action"] == "BUY":
            if decision["confidence"] < min_conf:
                log.push_log(
                    f"[Token] Confidence {decision['confidence']:.0%} "
                    f"below min {min_conf:.0%} — skipping"
                )
                decision["action"] = "HOLD"
            elif exe.has_position(symbol):
                log.push_log(f"[Token] Already have {symbol} position — skipping")
                decision["action"] = "HOLD"
            else:
                bnb_amount = max_pos_bnb * decision.get("size_pct", 0.5)
                log.push_log(f"[Token] Placing BUY {symbol} with {bnb_amount:.4f} BNB...")

                order_result = exe.execute_buy(
                    symbol=symbol,
                    token_address=token_address,
                    bnb_amount=bnb_amount,
                    max_position_bnb=max_pos_bnb,
                )

                if order_result and not order_result.get("skipped"):
                    # Log decision to chain
                    exe.log_decision_to_chain(
                        decision=decision,
                        market=market,
                        sentiment=sentiment,
                        pnl_usdc=0,
                    )

        elif decision["action"] == "SELL":
            if not exe.has_position(symbol):
                log.push_log(f"[Token] No {symbol} position to sell")
                decision["action"] = "HOLD"
            else:
                sell_amount = None  # Sell all
                log.push_log(f"[Token] Placing SELL {symbol}...")

                order_result = exe.execute_sell(
                    symbol=symbol,
                    token_amount=sell_amount,
                    reason=decision.get("reasoning", ""),
                )

                if order_result and not order_result.get("skipped"):
                    pnl_usdc = exe.compute_pnl(symbol, current_price)

                    # Log decision to chain
                    exe.log_decision_to_chain(
                        decision=decision,
                        market=market,
                        sentiment=sentiment,
                        pnl_usdc=pnl_usdc,
                    )
        else:
            log.push_log(f"[Token] HOLD — no order placed")

        # 7. Log to backend
        log.log_decision(decision, market, sentiment, order_result, pnl_usdc=pnl_usdc)
        log.send_heartbeat(symbol=symbol)

    except Exception as e:
        import traceback
        log.push_log(f"[Token] Cycle error for {token_address}: {e}")
        log.push_log(traceback.format_exc())
        log.send_heartbeat(symbol=market.get("symbol", "UNKNOWN"), error=str(e))


# ── Cycle orchestration ───────────────────────────────────────────────────────

def run_cycle(cfg: dict, cycle_count: int):
    scan_mode = cfg.get("scanMode", "trending")
    max_pos_bnb = cfg["maxPositionBnb"]
    min_conf = cfg["minConfidence"]
    stop_loss = cfg["stopLossPct"]
    take_profit = cfg["takeProfitPct"]
    max_positions = cfg["maxOpenPositions"]
    min_liq = cfg.get("minLiquidityUsd", 5000)
    max_rug = cfg.get("maxRugRisk", 50)
    bc_range = cfg.get("bondingCurveRange", (20, 80))

    log.push_log(f"{'='*56}")
    log.push_log(f"[4MemePilot] Cycle #{cycle_count} — Mode: {scan_mode}")
    log.push_log(f"  Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}  |  Max: {max_pos_bnb:.4f} BNB  |  MinConf: {min_conf:.0%}")
    log.push_log(f"  SL: {stop_loss}%  TP: {take_profit}%  MaxPositions: {max_positions}")
    log.push_log(f"  Filters: Liq>${min_liq}, Risk<{max_rug}, BC={bc_range}")
    log.push_log(f"{'='*56}")

    # ── Wallet context (once per cycle) ───────────────────────────────────────
    wallet_context = exe.get_wallet_context()
    log.push_log(
        f"  Wallet: BNB {wallet_context['bnb_balance']:.4f} | "
        f"Positions: {len(wallet_context['token_holdings'])} tokens"
    )

    # ── Live positions ────────────────────────────────────────────────────────
    live_positions = exe.get_open_positions()
    if live_positions:
        log.push_log(f"  Open positions: {list(live_positions.keys())}")

    # ── Token scanning ────────────────────────────────────────────────────────
    tokens_to_process = []

    if scan_mode == "watchlist" and cfg.get("watchlist"):
        # Use configured watchlist
        tokens_to_process = cfg["watchlist"]
        log.push_log(f"  Watchlist: {len(tokens_to_process)} tokens")

    elif scan_mode == "new":
        # Scan new launches
        opportunities = mkt.get_new_launches_snapshot(limit=20)
        tokens_to_process = [t["address"] for t in opportunities if not t.get("error")]
        log.push_log(f"  New launches: {len(tokens_to_process)} tokens")

    else:
        # Scan trending tokens with filters
        opportunities = mkt.scan_for_opportunities(
            min_liquidity=min_liq,
            max_rug_risk=max_rug,
            bonding_curve_range=bc_range,
        )
        tokens_to_process = [t["address"] for t in opportunities if not t.get("error")]
        log.push_log(f"  Opportunities found: {len(tokens_to_process)} tokens")

    if not tokens_to_process:
        log.push_log("[Cycle] No tokens to process this cycle")
        log.send_heartbeat()
        return

    # ── Parallel per-token processing ─────────────────────────────────────────
    # Process up to 5 tokens in parallel
    max_workers = min(len(tokens_to_process), 5)

    if len(tokens_to_process) == 1:
        process_token(tokens_to_process[0], cfg, wallet_context, live_positions)
    else:
        with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="token") as pool:
            futures = {
                pool.submit(process_token, addr, cfg, wallet_context, live_positions): addr
                for addr in tokens_to_process[:max_workers]
            }
            for future in as_completed(futures):
                addr = futures[future]
                try:
                    future.result()
                except Exception as e:
                    log.push_log(f"[Token] Unhandled exception for {addr}: {e}")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    log.push_log(f"[4MemePilot] Starting up. DRY_RUN: {DRY_RUN}, SCAN_MODE: {SCAN_MODE}")
    log.push_log("[4MemePilot] Trading 4.meme memecoins on BSC")

    cycle = 0

    while True:
        # Try to fetch config from backend, fall back to defaults
        cfg = fetch_config()
        if cfg is None:
            cfg = get_default_config()
            log.push_log("[Config] Using default configuration")

        if not cfg.get("enabled", True):
            log.push_log("[4MemePilot] Agent disabled by user — sleeping 30s...")
            time.sleep(30)
            continue

        # Set wallet address from backend config (onboarding flow)
        wallet_addr = cfg.get("walletAddress", "")
        if wallet_addr:
            os.environ["WALLET_ADDRESS"] = wallet_addr
            exe.WALLET_ADDRESS = wallet_addr  # Update executor module

        # Check wallet is configured
        if not os.getenv("WALLET_ADDRESS"):
            log.push_log("[4MemePilot] WALLET_ADDRESS not set — cannot trade. Sleeping 60s...")
            time.sleep(60)
            continue

        run_cycle(cfg, cycle)
        cycle += 1

        interval = int(os.getenv("LOOP_INTERVAL_SECONDS", "300"))
        log.push_log(f"[4MemePilot] Sleeping {interval}s until next cycle...")
        time.sleep(interval)


if __name__ == "__main__":
    main()
