# 4MemePilot — AI-Powered Memecoin Trading Bot for 4.meme

> **An autonomous AI trading agent specialised in meme tokens on the four.meme launchpad (BNB Smart Chain) — powered by Gemini AI, Elfa social intelligence, and tamper-proof on-chain decision logging.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-green.svg)](https://python.org)
[![Chain](https://img.shields.io/badge/chain-BNB%20Smart%20Chain-green.svg)]()
[![Hackathon](https://img.shields.io/badge/four.meme-AI%20Sprint%202026-yellow.svg)]()

**🏆 Submitted to:** [DoraHacks 4-meme AI Sprint](https://dorahacks.io/hackathon/fourmemeaisprint/detail)

---

## 🎯 What Is This?

**4MemePilot** is an autonomous AI trading bot that analyses and trades meme tokens on the **four.meme** launchpad. It combines:

- **On-chain metrics** (bonding curve progress, holder concentration, liquidity)
- **Social sentiment** from Elfa AI (mentions, engagement, trending rank)
- **AI reasoning** from Google Gemini 2.5 Flash

Every decision is logged to the [TradeLogger](contracts/README.md) contract on BSC for full transparency and auditability.

---

## 🚀 Key Features

| Feature | Description |
|---------|-------------|
| **AI Decision Engine** | Gemini 2.5 Flash analyses all signals and returns BUY/SELL/HOLD with confidence |
| **4.meme Native** | Direct integration with TokenManager contracts for trade execution |
| **Bonding Curve Analysis** | Real-time tracking of fill % from early stage to graduation |
| **Rug Risk Detection** | Holder concentration, liquidity checks, launch age filtering |
| **Elfa Social Sentiment** | Engagement scores, mention counts, trending rank |
| **On-Chain Audit Log** | Every decision logged to BSC via TradeLogger.sol |
| **Dry Run Mode** | Test strategies with real data without spending real BNB |
| **Non-Custodial** | Private keys never leave your machine |

---

## 📊 How It Works

### Decision Cycle (per token, every 5 minutes by default)

```
1. SCAN four.meme for trending/new tokens
     │
2. FETCH on-chain metrics
   ├─ Price (BNB/USD)
   ├─ Bonding curve fill %
   ├─ Holder count & concentration
   ├─ Liquidity pool size
   ├─ Buy/sell ratio (1h)
   └─ Launch age
     │
3. FETCH Elfa AI sentiment
   ├─ Engagement score (0-1)
   ├─ Mention count (24h)
   └─ Trending rank
     │
4. RUN rug detection checks
     │
5. PROMPT Gemini 2.5 Flash with all signals
     │
6. IF confidence > threshold AND no rug flags
   └─► EXECUTE trade via TokenManager contract
        │
7. LOG decision to TradeLogger.sol (BSC)
        │
8. TRACK position → exit on stop-loss/take-profit
```

---

## 🧠 AI Decision Framework

### Bonding Curve Stages

| Stage | Fill % | Interpretation |
|-------|--------|----------------|
| Not Started | 0% | Token not yet active |
| Early Stage | 1-30% | High risk/reward, sniper territory |
| **Momentum Phase** | **30-70%** | **Best buy window if social is strong** |
| Late Stage | 70-95% | Graduation pump potential, crowded |
| Graduation Soon | 90-100% | High volatility, near PancakeSwap |
| Graduated | 100% | Different dynamics on PancakeSwap |

### Rug Risk Indicators

The bot automatically flags or avoids tokens with:

- **Top-10 holders >60%** → HIGH concentration risk
- **Top-10 holders 40-60%** → MEDIUM risk
- **Launched <15 min ago** → Sniper territory
- **Liquidity <$3,000** → Exit risk
- **Rug risk score >50** → Configurable filter

### Buy Signal Confluence

The AI looks for multiple aligned signals:

✅ Bonding curve in momentum phase (30-70%)
✅ Low holder concentration (<40%)
✅ Buy/sell ratio >3:1 in last hour
✅ Elfa engagement score >0.6
✅ Trending rank <20
✅ Liquidity >$5,000

### Risk Management

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MAX_POSITION_BNB` | 0.1 BNB | Maximum per trade |
| `MIN_CONFIDENCE` | 55% | Minimum AI confidence |
| `STOP_LOSS_PCT` | 5% | Auto-exit on downside |
| `TAKE_PROFIT_PCT` | 10% | Auto-exit on profit |
| `MAX_OPEN_POSITIONS` | 3 | Concurrent positions |
| `MIN_LIQUIDITY_USD` | $5,000 | Filter low-liquidity tokens |
| `MAX_RUG_RISK` | 50 | Max acceptable risk score (0-100) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    4MemePilot Agent                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   market.py  │  │  sentiment.py│  │  strategy.py │      │
│  │  4.meme API  │  │   Elfa AI    │  │   Gemini     │      │
│  │   + on-chain │  │  engagement  │  │  decisions   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │   executor.py   │                        │
│                   │  BSC trades +   │                        │
│                   │  TradeLogger    │                        │
│                   └────────┬────────┘                        │
└────────────────────────────┼─────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐
       │  4.meme API │ │  BSC RPC  │ │  Elfa AI  │
       │  + TokenMgr │ │  (Web3)   │ │  API      │
       └─────────────┘ └───────────┘ └───────────┘
```

---

## 🛠️ Getting Started

### Prerequisites

- Python 3.11+
- BSC wallet (MetaMask, Trust Wallet, etc.)
- BSC testnet or mainnet BNB for gas
- Google Gemini API key
- Elfa AI API key (optional but recommended)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/MayurK-cmd/four-meme-BNB.git
cd four-meme-BNB/agent
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Run in dry-run mode (recommended)**
```bash
python main.py
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WALLET_ADDRESS` | BSC wallet address | (required) |
| `WALLET_PRIVATE_KEY` | BSC wallet private key | (required) |
| `BSC_RPC_URL` | BSC RPC endpoint | `https://bsc-dataseed.binance.org` |
| `GEMINI_API_KEY` | Google Gemini API key | (required) |
| `ELFA_API_KEY` | Elfa AI API key | (optional) |
| `DRY_RUN` | Simulation mode | `true` |
| `SCAN_MODE` | `trending`, `new`, or `watchlist` | `trending` |
| `MAX_POSITION_BNB` | Max BNB per trade | `0.1` |
| `MIN_CONFIDENCE` | Min AI confidence (0-1) | `0.55` |
| `STOP_LOSS_PCT` | Stop-loss % | `5.0` |
| `TAKE_PROFIT_PCT` | Take-profit % | `10.0` |
| `MAX_OPEN_POSITIONS` | Max concurrent positions | `3` |
| `MIN_LIQUIDITY_USD` | Min liquidity filter | `5000` |
| `MAX_RUG_RISK` | Max rug risk (0-100) | `50` |
| `LOOP_INTERVAL_SECONDS` | Cycle interval | `300` |

---

## 📜 Smart Contracts

### 4.meme Protocol (BSC)

| Contract | Address |
|----------|---------|
| TokenManager V1 | `0xEC4549caDcE5DA21Df6E6422d448034B5233bFbC` |
| TokenManager V2 | `0x5c952063c7fc8610FFDB798152D69F0B9550762b` |
| TokenManagerHelper3 | `0xF251F83e40a78868FcfA3FA4599Dad6494E46034` |

### 4MemePilot

| Contract | Address | Purpose |
|----------|---------|---------|
| TradeLogger | `0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B` | On-chain decision audit |

---

## 📡 API Reference

### 4.meme Endpoints

```python
# Get token info by address
GET https://four.meme/meme-api/v1/private/token/get?address=<addr>

# Get token by request ID (from TokenCreate event)
GET https://four.meme/meme-api/v1/private/token/getById?id=<requestId>

# Get trending tokens
GET https://four.meme/meme-api/v1/private/token/trending?limit=20

# Get new launches
GET https://four.meme/meme-api/v1/private/token/new?limit=20
```

### On-Chain Calls (TokenManagerHelper3)

```python
# Get token info
info = helperContract.functions.getTokenInfo(tokenAddress).call()

# Estimate buy (how many tokens for X BNB)
estimate = helperContract.functions.tryBuy(token, 0, bnbAmountWei).call()

# Estimate sell (how much BNB for X tokens)
estimate = helperContract.functions.trySell(token, tokenAmountWei).call()
```

---

## ⚠️ Risk Warning

**MEMECOIN TRADING IS EXTREMELY RISKY**

- This bot is for **educational/research purposes only**
- **Never trade more than you can afford to lose**
- **Always start with DRY_RUN=true**
- Test thoroughly before using real funds
- Rug pulls, sniper bots, and liquidity drains are common
- Past performance ≠ future results

### Safety Features

1. **Dry Run Mode**: Simulate trades without real BNB (default ON)
2. **Rug Risk Scoring**: Avoid obvious scams
3. **Liquidity Filters**: Only trade tokens with minimum liquidity
4. **Position Limits**: Cap exposure per trade
5. **Stop-Loss**: Automatic exit on downside
6. **On-Chain Audit**: All decisions logged for review

---

## 📁 Project Structure

```
four-meme-BNB/
├── agent/
│   ├── main.py              # Agent entry point
│   ├── market.py            # 4.meme market data
│   ├── strategy.py          # Gemini decision engine
│   ├── executor.py          # BSC trade execution
│   ├── sentiment.py         # Elfa AI sentiment
│   ├── four_meme.py         # 4.meme API + contract wrappers
│   ├── logger.py            # Decision logging
│   ├── StratergyPrompt.py   # Gemini prompt template
│   └── .env.example         # Environment template
├── contracts/
│   ├── TradeLogger.sol      # On-chain audit contract
│   └── README.md            # Contract deployment info
├── API-Documents.03-03-2026.md  # 4.meme API documentation
└── README.md                # This file
```

---

## 🏆 Hackathon Submission

This project is submitted to the **[DoraHacks 4-meme AI Sprint](https://dorahacks.io/hackathon/fourmemeaisprint/detail)**.

### What Makes This Special

1. **Real AI Decisions**: Not just rules — Gemini analyses all signals holistically
2. **4.meme Native**: Deep integration with bonding curve mechanics
3. **Risk-First Design**: Rug detection, liquidity filters, position limits
4. **On-Chain Proof**: All decisions logged to TradeLogger contract
5. **Dry-Run Testing**: Safe simulation before live trading

---

## 📄 License

MIT License — use at your own risk.

---

## 🙏 Acknowledgements

- **[four.meme](https://four.meme)** — Meme token launchpad and trading API
- **[BNB Smart Chain](https://bnbchain.org)** — On-chain decision logging
- **[Elfa AI](https://elfa.ai)** — Social sentiment intelligence
- **[Google Gemini](https://ai.google.dev)** — AI reasoning engine

---

**Built with ❤️ for the 4.meme community**

*Remember: Not financial advice. DYOR. Stay safe.*
