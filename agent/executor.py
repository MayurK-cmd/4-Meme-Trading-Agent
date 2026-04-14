"""
executor.py — 4.meme memecoin trade execution on BSC.

Replaces Pacifica order placement with 4.meme TokenManager contract calls:
  - BUY/SELL instead of LONG/SHORT
  - BSC transactions instead of Pacifica API
  - Token balance tracking instead of perpetual positions
  - Integration with TradeLogger contract for on-chain audit
"""

import os, json, time, uuid
from pathlib import Path
from dotenv import load_dotenv
from web3 import Web3

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

import four_meme as fm

# ── Configuration ─────────────────────────────────────────────────────────────

BSC_RPC_URL       = os.getenv("BSC_RPC_URL", "https://bsc-dataseed.binance.org")
WALLET_PRIVATE_KEY = os.getenv("WALLET_PRIVATE_KEY", "")
# WALLET_ADDRESS is set from backend config at runtime (see main.py)
WALLET_ADDRESS    = ""
DRY_RUN           = os.getenv("DRY_RUN", "true").lower() == "true"

# TradeLogger contract (deployed on BSC)
TRADE_LOGGER_ADDRESS = os.getenv("TRADE_LOGGER_ADDRESS", "0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B")

# TradeLogger ABI (minimal)
TRADE_LOGGER_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "tokenSymbol", "type": "string"},
            {"internalType": "address", "name": "tokenAddress", "type": "address"},
            {"internalType": "string", "name": "action", "type": "string"},
            {"internalType": "uint256", "name": "priceInWei", "type": "uint256"},
            {"internalType": "int256", "name": "pnlUsdc", "type": "int256"},
            {"internalType": "uint8", "name": "confidence", "type": "uint8"},
            {"internalType": "uint8", "name": "bondingCurvePct", "type": "uint8"},
            {"internalType": "uint32", "name": "socialScore", "type": "uint32"},
            {"internalType": "uint32", "name": "mentionCount", "type": "uint32"},
            {"internalType": "uint16", "name": "holderCount", "type": "uint16"},
            {"internalType": "bool", "name": "isTrending", "type": "bool"},
            {"internalType": "string", "name": "reasoning", "type": "string"},
            {"internalType": "bool", "name": "dryRun", "type": "bool"},
        ],
        "name": "logDecision",
        "outputs": [{"internalType": "uint256", "name": "id", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

# BSC Web3 setup
web3 = Web3(Web3.HTTPProvider(BSC_RPC_URL))
trade_logger = web3.eth.contract(address=TRADE_LOGGER_ADDRESS, abi=TRADE_LOGGER_ABI)

# ── Persistent position tracking ──────────────────────────────────────────────

POSITIONS_FILE = Path(__file__).parent / "positions.json"

_open_positions: dict = {}

def _load_positions() -> dict:
    """Load positions from disk on startup."""
    try:
        if POSITIONS_FILE.exists():
            data = json.loads(POSITIONS_FILE.read_text())
            print(f"[Executor] Loaded {len(data)} persisted position(s) from disk.")
            return data
    except Exception as e:
        print(f"[Executor] Could not load positions.json: {e}")
    return {}


def _save_positions():
    """Flush in-memory positions to disk after every mutation."""
    try:
        POSITIONS_FILE.write_text(json.dumps(_open_positions, indent=2))
    except Exception as e:
        print(f"[Executor] Could not save positions.json: {e}")


# Load persisted positions at import time
_open_positions = _load_positions()


# ── Wallet context ────────────────────────────────────────────────────────────

def get_wallet_context() -> dict:
    """
    Get current wallet state for strategy decisions.
    """
    if not WALLET_ADDRESS:
        return {"bnb_balance": 0.0, "token_holdings": []}

    bnb_balance = fm.get_wallet_bnb_balance(WALLET_ADDRESS)

    # Get token holdings from persisted positions
    token_holdings = []
    for symbol, pos in _open_positions.items():
        token_address = pos.get("address")
        if token_address:
            balance = fm.get_token_balance(token_address, WALLET_ADDRESS)
            if balance > 0:
                token_holdings.append({
                    "symbol": symbol,
                    "address": token_address,
                    "amount": balance,
                    "entry_price_usd": pos.get("entry_price_usd", 0),
                })

    return {
        "bnb_balance":      bnb_balance,
        "token_holdings":   token_holdings,
    }


# ── Position Management ───────────────────────────────────────────────────────

def get_open_positions() -> dict:
    """
    Get all open positions (from persisted state).
    For 4.meme, we track token holdings, not perpetual positions.
    """
    return _open_positions.copy()


def has_position(symbol: str) -> bool:
    """Check if we have an open position for a token."""
    return symbol in _open_positions


def get_position(symbol: str) -> dict:
    """Get position details for a token."""
    return _open_positions.get(symbol, {})


def compute_pnl(symbol: str, current_price_usd: float) -> float:
    """
    Calculate unrealized PnL for a position.
    """
    pos = _open_positions.get(symbol)
    if not pos:
        return 0.0

    entry_price = pos.get("entry_price_usd", 0)
    amount = pos.get("amount", 0)

    if entry_price <= 0 or amount <= 0:
        return 0.0

    # PnL = (current - entry) * amount
    pnl = (current_price_usd - entry_price) * amount
    return round(pnl, 4)


def should_exit(
    symbol: str,
    current_price_usd: float,
    stop_loss_pct: float,
    take_profit_pct: float,
) -> tuple:
    """
    Check if position should be exited based on stop-loss/take-profit.
    For 4.meme, we use simple percentage-based exits (not trailing for now).
    """
    pos = _open_positions.get(symbol)
    if not pos or pos.get("entry_price_usd", 0) <= 0:
        return False, ""

    entry_price = pos["entry_price_usd"]
    pnl_pct = ((current_price_usd - entry_price) / entry_price) * 100

    # Check stop-loss
    if pnl_pct <= -stop_loss_pct:
        return True, f"stop-loss ({pnl_pct:.1f}% <= -{stop_loss_pct}%)"

    # Check take-profit
    if pnl_pct >= take_profit_pct:
        return True, f"take-profit ({pnl_pct:.1f}% >= {take_profit_pct}%)"

    return False, ""


# ── Trade Execution ───────────────────────────────────────────────────────────

def execute_buy(
    symbol: str,
    token_address: str,
    bnb_amount: float,
    max_position_bnb: float,
    slippage_pct: float = 1.0,
) -> dict:
    """
    Execute a BUY order for a 4.meme token.
    """
    # Check if we already have a position
    if has_position(symbol):
        print(f"[Executor] Skipping {symbol}: already have position")
        return {"skipped": True, "reason": "existing_position", "symbol": symbol}

    # Cap position size
    capped_bnb = min(bnb_amount, max_position_bnb)

    # Check wallet balance
    wallet = get_wallet_context()
    if wallet["bnb_balance"] < capped_bnb * 0.9:
        print(f"[Executor] Insufficient BNB: have {wallet['bnb_balance']:.4f}, need {capped_bnb * 0.9:.4f}")
        return {"skipped": True, "reason": "insufficient_balance", "symbol": symbol}

    # Minimum order check
    if capped_bnb < 0.001:  # ~0.6 USD at current BNB price
        print(f"[Executor] Order too small: {capped_bnb:.4f} BNB")
        return {"skipped": True, "reason": "below_min_order", "symbol": symbol}

    if DRY_RUN:
        print(f"[DRY RUN] Would buy {symbol} with {capped_bnb:.4f} BNB")
        # Estimate tokens for dry run display
        estimate = fm.estimate_buy_tokens(token_address, capped_bnb)
        expected_tokens = estimate.get("expected_tokens", 0)
        decimals = fm._get_token_decimals(token_address)
        token_display = expected_tokens / (10 ** decimals)

        return {
            "dry_run": True,
            "symbol": symbol,
            "token_address": token_address,
            "bnb_spent": capped_bnb,
            "expected_tokens": token_display,
            "status": "simulated",
        }

    # Execute real buy
    result = fm.buy_token(
        token_address=token_address,
        bnb_amount=capped_bnb,
        slippage_pct=slippage_pct,
    )

    if result.get("success"):
        # Record position
        token_info = fm.get_token_by_address(token_address)
        _open_positions[symbol] = {
            "symbol": symbol,
            "address": token_address,
            "side": "long",  # Always long for spot
            "amount": result.get("tokens_received", 0) / 1e18,  # Approximate
            "entry_price_usd": token_info.get("price_usd", 0),
            "entry_bnb": capped_bnb,
            "entry_time": time.time(),
        }
        _save_positions()

        print(f"[Executor] Bought {symbol}: {capped_bnb:.4f} BNB → {result.get('tokens_received', 0)} tokens")

    return result


def execute_sell(
    symbol: str,
    token_amount: float = None,  # None = sell all
    slippage_pct: float = 1.0,
    reason: str = "",
) -> dict:
    """
    Execute a SELL order for a 4.meme token.
    """
    pos = _open_positions.get(symbol)
    if not pos:
        print(f"[Executor] No position for {symbol}")
        return {"skipped": True, "reason": "no_position"}

    token_address = pos["address"]
    sell_amount = token_amount

    # If no amount specified, sell entire balance
    if sell_amount is None:
        sell_amount = fm.get_token_balance(token_address, WALLET_ADDRESS)
        print(f"[Executor] Selling entire {symbol} balance: {sell_amount:.4f} tokens")

    if sell_amount <= 0:
        print(f"[Executor] No {symbol} tokens to sell")
        _open_positions.pop(symbol, None)
        _save_positions()
        return {"skipped": True, "reason": "zero_balance"}

    if DRY_RUN:
        print(f"[DRY RUN] Would sell {sell_amount:.4f} {symbol} tokens")
        estimate = fm.estimate_sell_bnb(token_address, sell_amount)
        expected_bnb = estimate.get("expected_bnb", 0) if not estimate.get("error") else 0

        _open_positions.pop(symbol, None)
        _save_positions()

        return {
            "dry_run": True,
            "symbol": symbol,
            "tokens_sold": sell_amount,
            "expected_bnb": expected_bnb,
            "reason": reason,
            "status": "simulated",
        }

    # Execute real sell
    result = fm.sell_token(
        token_address=token_address,
        token_amount=sell_amount,
        slippage_pct=slippage_pct,
    )

    if result.get("success"):
        _open_positions.pop(symbol, None)
        _save_positions()

        print(f"[Executor] Sold {symbol}: {sell_amount:.4f} tokens → {result.get('bnb_received', 0):.6f} BNB")

    return result


def close_position(symbol: str, reason: str = "") -> dict:
    """
    Close an existing position (sell all tokens).
    """
    return execute_sell(symbol, token_amount=None, reason=reason)


# ── TradeLogger Integration ───────────────────────────────────────────────────

def log_decision_to_chain(
    decision: dict,
    market: dict,
    sentiment: dict,
    pnl_usdc: float = 0,
) -> dict:
    """
    Log trading decision to TradeLogger contract on BSC.
    Only logs HOLD/BUY/SELL decisions (not internal errors).
    """
    if DRY_RUN:
        print(f"[DRY RUN] Would log decision to chain: {decision['action']} {decision['symbol']}")
        return {"dry_run": True, "status": "simulated"}

    try:
        wallet = fm._get_wallet()

        # Prepare arguments
        token_symbol = str(decision.get("symbol", "UNKNOWN"))[:32]
        token_address = decision.get("address", market.get("address", ""))
        action = str(decision.get("action", "HOLD"))[:16]
        price_wei = int(market.get("price_usd", 0) * 1e10)  # Scale USD to wei-like
        pnl_wei = int(pnl_usdc * 1e6)  # Scale to micro-USD
        confidence = int(min(decision.get("confidence", 0) * 100, 100))
        bonding_pct = int(min(market.get("bonding_curve_pct", 0), 100))
        social_score = int(min(sentiment.get("sentiment_score", 0) * 1000, 1000))
        mention_count = int(min(sentiment.get("mention_count", 0), 65535))
        holder_count = int(min(market.get("holder_count", 0), 65535))
        is_trending = bool(market.get("is_trending_4meme") or sentiment.get("trending_score", 0) > 50)
        reasoning = str(decision.get("reasoning", ""))[:500]  # Truncate for gas

        # Build transaction
        tx = trade_logger.functions.logDecision(
            tokenSymbol=token_symbol,
            tokenAddress=token_address,
            action=action,
            priceInWei=price_wei,
            pnlUsdc=pnl_wei,
            confidence=confidence,
            bondingCurvePct=bonding_pct,
            socialScore=social_score,
            mentionCount=mention_count,
            holderCount=holder_count,
            isTrending=is_trending,
            reasoning=reasoning,
            dryRun=DRY_RUN,
        ).build_transaction({
            "from": wallet.address,
            "nonce": web3.eth.get_transaction_count(wallet.address),
            "gasPrice": web3.eth.gas_price,
        })

        # Sign and send
        signed = wallet.sign_transaction(tx)
        tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)

        # Wait for confirmation
        receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        if receipt["status"] == 1:
            return {
                "success": True,
                "tx_hash": tx_hash.hex(),
                "symbol": token_symbol,
                "action": action,
            }
        else:
            return {"success": False, "error": "Transaction reverted", "tx_hash": tx_hash.hex()}

    except Exception as e:
        print(f"[Executor] Failed to log decision to chain: {e}")
        return {"success": False, "error": str(e)}


# ── Account Info ──────────────────────────────────────────────────────────────

def get_account_info() -> dict:
    """
    Get wallet account summary.
    """
    if not WALLET_ADDRESS:
        return {
            "bnb_balance": 0.0,
            "token_holdings": [],
            "open_positions": 0,
        }

    context = get_wallet_context()
    positions = get_open_positions()

    return {
        "address":          WALLET_ADDRESS,
        "bnb_balance":      context["bnb_balance"],
        "token_holdings":   context["token_holdings"],
        "open_positions":   len(positions),
        "position_symbols": list(positions.keys()),
    }
