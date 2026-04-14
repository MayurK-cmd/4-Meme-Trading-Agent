"""
four_meme.py — 4.meme token data, bonding curve status, and trade execution.

This module replaces Pacifica-specific market data with 4.meme memecoin metrics:
  - Token info (price, liquidity, holders, bonding curve progress)
  - New token launches / trending tokens
  - Buy/sell execution via TokenManager contracts on BSC

API Docs: https://four.meme/meme-api/v1/private/
"""

import os, time, requests, json
from pathlib import Path
from dotenv import load_dotenv
from web3 import Web3
import asyncio

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# ── Configuration ─────────────────────────────────────────────────────────────

FOUR_MEME_BASE_URL = os.getenv("FOUR_MEME_BASE_URL", "https://four.meme/meme-api/v1")
BSC_RPC_URL        = os.getenv("BSC_RPC_URL", "https://bsc-dataseed.binance.org")
WALLET_PRIVATE_KEY = os.getenv("WALLET_PRIVATE_KEY", "")
WALLET_ADDRESS     = os.getenv("WALLET_ADDRESS", "")
DRY_RUN            = os.getenv("DRY_RUN", "true").lower() == "true"

# TokenManager contracts (from API docs)
TOKEN_MANAGER_V1   = "0xEC4549caDcE5DA21Df6E6422d448034B5233bFbC"
TOKEN_MANAGER_V2   = "0x5c952063c7fc8610FFDB798152D69F0B9550762b"
TOKEN_HELPER_V3    = "0xF251F83e40a78868FcfA3FA4599Dad6494E46034"  # TokenManagerHelper3

# WBNB address (for ERC20 pairs)
WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"

# BSC Web3 setup
web3 = Web3(Web3.HTTPProvider(BSC_RPC_URL))

# TokenManagerHelper3 ABI (minimal — only what we need)
HELPER_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "token", "type": "address"}],
        "name": "getTokenInfo",
        "outputs": [
            {"internalType": "uint256", "name": "version", "type": "uint256"},
            {"internalType": "address", "name": "tokenManager", "type": "address"},
            {"internalType": "address", "name": "quote", "type": "address"},
            {"internalType": "uint256", "name": "lastPrice", "type": "uint256"},
            {"internalType": "uint256", "name": "tradingFeeRate", "type": "uint256"},
            {"internalType": "uint256", "name": "minTradingFee", "type": "uint256"},
            {"internalType": "uint256", "name": "launchTime", "type": "uint256"},
            {"internalType": "uint256", "name": "offers", "type": "uint256"},
            {"internalType": "uint256", "name": "maxOffers", "type": "uint256"},
            {"internalType": "uint256", "name": "funds", "type": "uint256"},
            {"internalType": "uint256", "name": "maxFunds", "type": "uint256"},
            {"internalType": "bool", "name": "liquidityAdded", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "token", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
            {"internalType": "uint256", "name": "funds", "type": "uint256"},
        ],
        "name": "tryBuy",
        "outputs": [
            {"internalType": "address", "name": "tokenManager", "type": "address"},
            {"internalType": "address", "name": "quote", "type": "address"},
            {"internalType": "uint256", "name": "estimatedAmount", "type": "uint256"},
            {"internalType": "uint256", "name": "estimatedCost", "type": "uint256"},
            {"internalType": "uint256", "name": "estimatedFee", "type": "uint256"},
            {"internalType": "uint256", "name": "amountMsgValue", "type": "uint256"},
            {"internalType": "uint256", "name": "amountApproval", "type": "uint256"},
            {"internalType": "uint256", "name": "amountFunds", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
]

# ERC20 ABI (for approval)
ERC20_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "spender", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
        ],
        "name": "approve",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

helper_contract = web3.eth.contract(address=TOKEN_HELPER_V3, abi=HELPER_ABI)

# ── API Helpers ────────────────────────────────────────────────────────────────

def _api_get(path: str, params: dict = None, retries: int = 3) -> dict:
    """Call 4.meme API with retry logic."""
    url = f"{FOUR_MEME_BASE_URL}{path}"
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") == "0":
                return data.get("data", {})
            print(f"[4-meme] API error: {data}")
            return {}
        except Exception as e:
            wait = 2 ** attempt
            print(f"[4-meme] {path} attempt {attempt+1}/{retries} failed: {e}. Waiting {wait}s...")
            time.sleep(wait)
    return {}


# ── Token Data Fetching ────────────────────────────────────────────────────────

def get_token_by_address(address: str) -> dict:
    """
    Fetch token info from 4.meme API by contract address.
    Returns dict with all token metrics needed for trading decisions.
    """
    data = _api_get("/private/token/get", params={"address": address})
    if not data:
        return {}

    # Parse token basic info
    token_info = data.get("tokenInfo", {}) or data

    # Extract bonding curve progress
    bonding_curve_pct = 0.0
    if token_info.get("offers") and token_info.get("maxOffers"):
        offers = float(token_info.get("offers", 0))
        max_offers = float(token_info.get("maxOffers", 1))
        if max_offers > 0:
            bonding_curve_pct = ((max_offers - offers) / max_offers) * 100

    # Calculate launch age in minutes
    launched_min_ago = 0
    launch_time = token_info.get("launchTime", 0)
    if launch_time:
        launched_min_ago = int((time.time() - int(launch_time)) / 60)

    # Top 10 holder percentage (rug risk indicator)
    top10_holder_pct = 0.0
    holder_distribution = data.get("holderDistribution", {})
    if holder_distribution:
        top10_pct = holder_distribution.get("top10HolderPercent", 0)
        top10_holder_pct = float(top10_pct) if top10_pct else 0.0

    # Buy/sell counts in last 1h
    trade_stats = data.get("tradeStats", {}) or {}
    buy_count_1h = int(trade_stats.get("buyCount1h", 0) or 0)
    sell_count_1h = int(trade_stats.get("sellCount1h", 0) or 0)

    # Price in BNB and USD
    price_raw = token_info.get("lastPrice", 0) or 0
    price_bnb = float(price_raw) / 1e18 if price_raw else 0.0

    # Liquidity in USD (funds raised in BNB * BNB price)
    funds_raised = float(token_info.get("funds", 0) or 0) / 1e18
    bnb_price_usd = get_bnb_price_usd()
    liquidity_usd = funds_raised * bnb_price_usd

    return {
        "symbol":              str(token_info.get("symbol", "UNKNOWN")).upper(),
        "address":             address,
        "name":                token_info.get("name", "Unknown Token"),
        "price_bnb":           price_bnb,
        "price_usd":           price_bnb * bnb_price_usd if price_bnb else 0.0,
        "market_cap_usd":      float(token_info.get("marketCap", 0) or 0),
        "volume_24h_usd":      float(trade_stats.get("volume24h", 0) or 0),
        "holder_count":        int(token_info.get("holderCount", 0) or 0),
        "bonding_curve_pct":   bonding_curve_pct,
        "launched_min_ago":    launched_min_ago,
        "liquidity_usd":       liquidity_usd,
        "top10_holder_pct":    top10_holder_pct,
        "buy_count_1h":        buy_count_1h,
        "sell_count_1h":       sell_count_1h,
        # Additional 4-meme specific fields
        "version":             data.get("version", "V2"),
        "is_trending_4meme":   data.get("isTrending", False),
        "trending_rank_4meme": data.get("trendingRank", None),
        "fee_plan":            data.get("feePlan", False),  # AntiSniperFeeMode
        "ai_creator":          data.get("aiCreator", False),
        "tax_info":            data.get("taxInfo", None),
        # Raw data for on-chain verification
        "offers":              int(token_info.get("offers", 0) or 0),
        "max_offers":          int(token_info.get("maxOffers", 0) or 0),
        "funds_raised_bnb":    funds_raised,
        "launch_time":         int(launch_time) if launch_time else 0,
    }


def get_trending_tokens(limit: int = 20) -> list:
    """
    Fetch trending tokens from 4.meme API.
    Returns list of token addresses sorted by trending score.
    """
    data = _api_get("/private/token/trending", params={"limit": limit})
    if not data:
        return []

    tokens = data.get("tokens", []) if isinstance(data, dict) else data
    return [t.get("address") for t in tokens if t.get("address")]


def get_new_launches(limit: int = 20, offset: int = 0) -> list:
    """
    Fetch newly launched tokens from 4.meme.
    Returns list of token addresses sorted by launch time (newest first).
    """
    data = _api_get("/private/token/new", params={"limit": limit, "offset": offset})
    if not data:
        return []

    tokens = data.get("tokens", []) if isinstance(data, dict) else data
    return [t.get("address") for t in tokens if t.get("address")]


def get_token_by_id(request_id: int) -> dict:
    """
    Fetch token info by request ID (from TokenCreate event).
    """
    data = _api_get("/private/token/getById", params={"id": request_id})
    if not data:
        return {}
    return get_token_by_address(data.get("address", ""))


# ── Price Feeds ────────────────────────────────────────────────────────────────

_bnb_price_cache = {"price": 0.0, "timestamp": 0}

def get_bnb_price_usd() -> float:
    """Fetch current BNB price in USD (cached for 60s)."""
    now = time.time()
    if _bnb_price_cache["timestamp"] > 0 and now - _bnb_price_cache["timestamp"] < 60:
        return _bnb_price_cache["price"]

    try:
        # Use Binance API for BNB price
        resp = requests.get(
            "https://api.binance.com/api/v3/ticker/price",
            params={"symbol": "BNBUSDT"},
            timeout=10,
        )
        resp.raise_for_status()
        price = float(resp.json().get("price", 0))
        _bnb_price_cache["price"] = price
        _bnb_price_cache["timestamp"] = now
        return price
    except Exception as e:
        print(f"[4-meme] Failed to fetch BNB price: {e}")
        return _bnb_price_cache["price"] or 600.0  # fallback


# ── On-chain Token Info ────────────────────────────────────────────────────────

def get_token_info_onchain(token_address: str) -> dict:
    """
    Fetch token info directly from TokenManagerHelper3 contract.
    More reliable than API for real-time bonding curve status.
    """
    try:
        info = helper_contract.functions.getTokenInfo(token_address).call()
        return {
            "version":          int(info[0]),  # 1=V1, 2=V2
            "token_manager":    info[1],
            "quote_token":      info[2],  # address(0) = BNB, else ERC20 pair
            "last_price":       int(info[3]),
            "trading_fee_rate": int(info[4]),  # basis points (100 = 1%)
            "min_trading_fee":  int(info[5]),
            "launch_time":      int(info[6]),
            "offers":           int(info[7]),  # remaining tokens for sale
            "max_offers":       int(info[8]),
            "funds":            int(info[9]),  # BNB raised
            "max_funds":        int(info[10]),
            "liquidity_added":  bool(info[11]),  # graduated to PancakeSwap
        }
    except Exception as e:
        print(f"[4-meme] On-chain token info failed for {token_address}: {e}")
        return {}


def get_bonding_curve_progress(token_address: str) -> dict:
    """
    Calculate bonding curve fill percentage and graduation status.
    """
    info = get_token_info_onchain(token_address)
    if not info:
        return {"bonding_curve_pct": 0.0, "graduated": False, "graduation_imminent": False}

    max_offers = info["max_offers"]
    offers_left = info["offers"]

    if max_offers > 0:
        sold_pct = ((max_offers - offers_left) / max_offers) * 100
    else:
        sold_pct = 0.0

    graduated = info["liquidity_added"]
    imminent = sold_pct >= 90 and not graduated

    return {
        "bonding_curve_pct":   round(sold_pct, 2),
        "graduated":           graduated,
        "graduation_imminent": imminent,
        "offers_sold":         max_offers - offers_left,
        "offers_left":         offers_left,
        "funds_raised_wei":    info["funds"],
        "funds_raised_bnb":    info["funds"] / 1e18,
    }


# ── Wallet & Balance ──────────────────────────────────────────────────────────

def get_wallet_bnb_balance(wallet_address: str = None) -> float:
    """Get BNB balance for the trading wallet."""
    addr = wallet_address or WALLET_ADDRESS
    if not addr:
        return 0.0
    try:
        balance_wei = web3.eth.get_balance(addr)
        return float(balance_wei) / 1e18
    except Exception as e:
        print(f"[4-meme] Failed to get BNB balance: {e}")
        return 0.0


def get_token_balance(token_address: str, wallet_address: str = None) -> float:
    """Get balance of a specific token for the trading wallet."""
    addr = wallet_address or WALLET_ADDRESS
    if not addr:
        return 0.0
    try:
        token_contract = web3.eth.contract(address=token_address, abi=ERC20_ABI)
        balance = token_contract.functions.balanceOf(addr).call()
        # Get token decimals
        decimals = _get_token_decimals(token_address)
        return float(balance) / (10 ** decimals)
    except Exception as e:
        print(f"[4-meme] Failed to get token balance: {e}")
        return 0.0


def _get_token_decimals(token_address: str) -> int:
    """Get token decimals (default 18 if not found)."""
    try:
        token_contract = web3.eth.contract(address=token_address, abi=ERC20_ABI)
        return token_contract.functions.decimals().call()
    except:
        return 18  # default for most tokens


# ── Trade Execution ────────────────────────────────────────────────────────────

def _get_wallet() -> object:
    """Get Web3 wallet from private key."""
    if not WALLET_PRIVATE_KEY:
        raise RuntimeError("WALLET_PRIVATE_KEY not set in .env")
    return web3.eth.account.from_key(WALLET_PRIVATE_KEY)


def approve_token(token_address: str, spender: str, amount: int) -> dict:
    """
    Approve TokenManager to spend token (for sell operations).
    """
    try:
        wallet = _get_wallet()
        token_contract = web3.eth.contract(address=token_address, abi=ERC20_ABI)

        # Build approval transaction
        tx = token_contract.functions.approve(spender, amount).build_transaction({
            "from": wallet.address,
            "nonce": web3.eth.get_transaction_count(wallet.address),
            "gasPrice": web3.eth.gas_price,
        })

        if DRY_RUN:
            print(f"[DRY RUN] Would approve {amount} tokens to {spender}")
            return {"dry_run": True, "status": "simulated"}

        # Sign and send
        signed = wallet.sign_transaction(tx)
        tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)

        # Wait for confirmation
        receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        return {
            "success": receipt["status"] == 1,
            "tx_hash": tx_hash.hex(),
        }
    except Exception as e:
        print(f"[4-meme] Token approval failed: {e}")
        return {"success": False, "error": str(e)}


def buy_token(
    token_address: str,
    bnb_amount: float,
    min_tokens: int = 0,
    slippage_pct: float = 1.0,
) -> dict:
    """
    Buy tokens using TokenManager contract.

    Args:
        token_address: Token contract address
        bnb_amount: Amount of BNB to spend
        min_tokens: Minimum tokens to receive (with slippage protection)
        slippage_pct: Slippage tolerance percentage

    Returns:
        dict with tx_hash, success, tokens_received
    """
    try:
        wallet = _get_wallet()

        # Get token info to determine version and quote
        token_info = get_token_by_address(token_address)
        onchain_info = get_token_info_onchain(token_address)

        if not onchain_info:
            return {"success": False, "error": "Failed to fetch token info"}

        # Determine TokenManager version
        version = onchain_info["version"]
        token_manager = onchain_info["token_manager"]
        quote = onchain_info["quote_token"]

        # Calculate expected tokens (estimate)
        estimated = estimate_buy_tokens(token_address, bnb_amount)
        if estimated.get("error"):
            return estimated

        expected_tokens = int(estimated["expected_tokens"])
        min_tokens = int(expected_tokens * (100 - slippage_pct) / 100)

        # Build buy transaction based on version
        if version == 1:
            # V1: purchaseTokenAMAP(address token, uint256 funds, uint256 minAmount)
            # Note: V1 only supports BNB pairs
            func = web3.eth.contract(
                address=token_manager,
                abi=[{
                    "inputs": [
                        {"internalType": "address", "name": "token", "type": "address"},
                        {"internalType": "uint256", "name": "funds", "type": "uint256"},
                        {"internalType": "uint256", "name": "minAmount", "type": "uint256"},
                    ],
                    "name": "purchaseTokenAMAP",
                    "outputs": [],
                    "stateMutability": "payable",
                    "type": "function",
                }]
            ).functions.purchaseTokenAMAP(
                token_address,
                int(bnb_amount * 1e18),
                min_tokens,
            )
        else:
            # V2: buyTokenAMAP(address token, uint256 funds, uint256 minAmount)
            func = web3.eth.contract(
                address=token_manager,
                abi=[{
                    "inputs": [
                        {"internalType": "address", "name": "token", "type": "address"},
                        {"internalType": "uint256", "name": "funds", "type": "uint256"},
                        {"internalType": "uint256", "name": "minAmount", "type": "uint256"},
                    ],
                    "name": "buyTokenAMAP",
                    "outputs": [],
                    "stateMutability": "payable",
                    "type": "function",
                }]
            ).functions.buyTokenAMAP(
                token_address,
                int(bnb_amount * 1e18),
                min_tokens,
            )

        # Build transaction
        tx = func.build_transaction({
            "from": wallet.address,
            "value": int(bnb_amount * 1e18),
            "nonce": web3.eth.get_transaction_count(wallet.address),
            "gasPrice": web3.eth.gas_price,
        })

        if DRY_RUN:
            print(f"[DRY RUN] Would buy {token_address} with {bnb_amount} BNB")
            return {
                "dry_run": True,
                "status": "simulated",
                "token": token_address,
                "bnb_spent": bnb_amount,
                "expected_tokens": expected_tokens,
            }

        # Sign and send
        signed = wallet.sign_transaction(tx)
        tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)

        # Wait for confirmation
        receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        if receipt["status"] == 1:
            return {
                "success": True,
                "tx_hash": tx_hash.hex(),
                "tokens_received": expected_tokens,
                "bnb_spent": bnb_amount,
            }
        else:
            return {"success": False, "error": "Transaction reverted", "tx_hash": tx_hash.hex()}

    except Exception as e:
        print(f"[4-meme] Buy failed: {e}")
        return {"success": False, "error": str(e)}


def sell_token(
    token_address: str,
    token_amount: float,
    min_bnb: float = 0,
    slippage_pct: float = 1.0,
) -> dict:
    """
    Sell tokens using TokenManager contract.

    Args:
        token_address: Token contract address
        token_amount: Amount of tokens to sell
        min_bnb: Minimum BNB to receive
        slippage_pct: Slippage tolerance percentage

    Returns:
        dict with tx_hash, success, bnb_received
    """
    try:
        wallet = _get_wallet()

        # Get token info
        onchain_info = get_token_info_onchain(token_address)
        if not onchain_info:
            return {"success": False, "error": "Failed to fetch token info"}

        version = onchain_info["version"]
        token_manager = onchain_info["token_manager"]

        # Get token decimals
        decimals = _get_token_decimals(token_address)
        token_amount_wei = int(token_amount * (10 ** decimals))

        # Estimate sale proceeds
        estimated = estimate_sell_bnb(token_address, token_amount)
        if estimated.get("error"):
            return estimated

        expected_bnb = float(estimated["expected_bnb"])
        min_bnb = expected_bnb * (100 - slippage_pct) / 100
        min_bnb_wei = int(min_bnb * 1e18)

        # First approve TokenManager to spend tokens
        approve_result = approve_token(token_address, token_manager, token_amount_wei)
        if not approve_result.get("success") and not approve_result.get("dry_run"):
            return {"success": False, "error": "Approval failed", "details": approve_result}

        # Build sell transaction
        if version == 1:
            # V1: saleToken(address token, uint256 amount)
            func = web3.eth.contract(
                address=token_manager,
                abi=[{
                    "inputs": [
                        {"internalType": "address", "name": "token", "type": "address"},
                        {"internalType": "uint256", "name": "amount", "type": "uint256"},
                    ],
                    "name": "saleToken",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function",
                }]
            ).functions.saleToken(token_address, token_amount_wei)
        else:
            # V2: sellToken(address token, uint256 amount)
            func = web3.eth.contract(
                address=token_manager,
                abi=[{
                    "inputs": [
                        {"internalType": "address", "name": "token", "type": "address"},
                        {"internalType": "uint256", "name": "amount", "type": "uint256"},
                    ],
                    "name": "sellToken",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function",
                }]
            ).functions.sellToken(token_address, token_amount_wei)

        # Build transaction
        tx = func.build_transaction({
            "from": wallet.address,
            "nonce": web3.eth.get_transaction_count(wallet.address),
            "gasPrice": web3.eth.gas_price,
        })

        if DRY_RUN:
            print(f"[DRY RUN] Would sell {token_amount} tokens for ~{expected_bnb:.6f} BNB")
            return {
                "dry_run": True,
                "status": "simulated",
                "token": token_address,
                "tokens_sold": token_amount,
                "expected_bnb": expected_bnb,
            }

        # Sign and send
        signed = wallet.sign_transaction(tx)
        tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)

        # Wait for confirmation
        receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        if receipt["status"] == 1:
            return {
                "success": True,
                "tx_hash": tx_hash.hex(),
                "bnb_received": expected_bnb,
                "tokens_sold": token_amount,
            }
        else:
            return {"success": False, "error": "Transaction reverted", "tx_hash": tx_hash.hex()}

    except Exception as e:
        print(f"[4-meme] Sell failed: {e}")
        return {"success": False, "error": str(e)}


# ── Trade Estimation (Pre-calculation) ────────────────────────────────────────

def estimate_buy_tokens(token_address: str, bnb_amount: float) -> dict:
    """
    Estimate how many tokens you'll receive for a given BNB amount.
    Uses tryBuy() call to TokenManagerHelper3 for accurate estimation.
    """
    try:
        result = helper_contract.functions.tryBuy(
            token_address,
            0,  # amount = 0 means funds-based
            int(bnb_amount * 1e18),
        ).call()

        return {
            "expected_tokens": int(result[2]),
            "estimated_cost": int(result[3]),
            "estimated_fee": int(result[4]),
        }
    except Exception as e:
        print(f"[4-meme] Buy estimation failed: {e}")
        return {"error": str(e)}


def estimate_sell_bnb(token_address: str, token_amount: float) -> dict:
    """
    Estimate how much BNB you'll receive for selling tokens.
    """
    try:
        # Get token decimals
        decimals = _get_token_decimals(token_address)
        amount_wei = int(token_amount * (10 ** decimals))

        # Call trySell via static call (read-only)
        # Note: trySell signature may vary, adjust as needed
        result = helper_contract.functions.trySell(
            token_address,
            amount_wei,
        ).call()

        return {
            "expected_bnb": float(result[2]) / 1e18,
            "estimated_fee": float(result[3]) / 1e18,
        }
    except Exception as e:
        print(f"[4-meme] Sell estimation failed: {e}")
        return {"error": str(e)}


# ── Utility Functions ─────────────────────────────────────────────────────────

def is_token_graduated(token_address: str) -> bool:
    """Check if token has graduated to PancakeSwap."""
    info = get_token_info_onchain(token_address)
    return info.get("liquidity_added", False) if info else False


def is_x_mode_token(token_address: str) -> bool:
    """Check if token is X Mode exclusive (requires special buy method)."""
    data = get_token_by_address(token_address)
    return data.get("version") == "V8"


def is_tax_token(token_address: str) -> bool:
    """Check if token has tax/reward mechanism (creator type 5)."""
    data = get_token_by_address(token_address)
    return data.get("tax_info") is not None


def has_anti_sniper_fee(token_address: str) -> bool:
    """Check if token has dynamic anti-sniper fees."""
    data = get_token_by_address(token_address)
    return data.get("fee_plan", False)


def is_ai_creator_token(token_address: str) -> bool:
    """Check if token was created by an AI agent."""
    data = get_token_by_address(token_address)
    return data.get("ai_creator", False)
