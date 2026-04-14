# PacificaPilot 🤖

> **An autonomous AI trading agent for meme tokens on four.meme (BNB Smart Chain) — powered by Gemini AI, Elfa social intelligence, and tamper-proof on-chain decision logging.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-green.svg)](https://python.org)
[![Node](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-19-blue.svg)](https://react.dev)
[![Track](https://img.shields.io/badge/track-AI%20Agents-orange.svg)]()
[![Hackathon](https://img.shields.io/badge/four.meme-AI%20Sprint%202026-yellow.svg)]()
[![Chain](https://img.shields.io/badge/chain-BNB%20Smart%20Chain-green.svg)]()

**🏆 four.meme AI Sprint Submission** — AI Agents · BNB Smart Chain

---

## 🎥 Demo

| Resource | Link |
|----------|------|
| **Demo Video** | []() |
| **TradeLogger Contract (BSC Testnet)** | *()* |
| **four.meme** | [four.meme](https://four.meme) |

---

## The Problem

Meme token trading on four.meme moves at a speed that humans simply can't keep up with. A token can go from launch to bonding curve graduation in under 30 minutes. Retail traders miss entries because they're watching the wrong token, can't process social signals fast enough, and have no way to verify whether a bot's decisions were actually based on the data it claims — or whether it was just lucky.

**PacificaPilot solves this.** It is a fully autonomous, non-custodial AI agent that monitors four.meme launches in real time, combines on-chain metrics with Elfa social intelligence, and runs every decision through Gemini AI — then logs each decision permanently on BNB Smart Chain so anyone can verify the reasoning, the signals, and the outcome.

---

## What It Does

PacificaPilot runs a continuous decision loop for each meme token it monitors:

1. **Scans four.meme** for token price, bonding curve fill %, holder count, liquidity, and buy/sell transaction ratio
2. **Pulls social sentiment from Elfa AI** — mention counts, engagement scores, trending rank, and sentiment label
3. **Sends everything to Gemini 2.5 Flash** — the AI reasons across all signals and returns BUY / SELL / HOLD with a confidence score, position size, and written reasoning
4. **Executes the trade on four.meme** if confidence clears your threshold and no rug risk flags are raised
5. **Logs the decision on-chain** via `TradeLogger.sol` deployed on BSC — token address, action, signals, and a keccak256 hash of Gemini's full reasoning are stored permanently
6. **Streams everything to a live React dashboard** — every decision, every on-chain log link, every PnL update, in real time

---

## Why It's Different

| Feature | PacificaPilot | Typical Meme Bot |
|---------|--------------|-----------------|
| AI Reasoning Engine | ✅ Gemini 2.5 Flash | ❌ Rule-based snipers |
| Social Sentiment Layer | ✅ Elfa AI — mentions, engagement, trending | ❌ Price data only |
| On-Chain Decision Audit | ✅ Every decision logged on BSC via TradeLogger.sol | ❌ No verifiability |
| Tamper-Proof Reasoning | ✅ keccak256 hash of Gemini output stored on-chain | ❌ Trust the bot's word |
| Rug Detection | ✅ Concentration risk, liquidity floor, launch age checks | ⚠️ Rarely included |
| Non-Custodial | ✅ Keys never leave your machine | ❌ Often requires key upload |
| Live PnL Dashboard | ✅ Real-time unrealized + realized PnL + BscScan links | ❌ Terminal output |
| Dry Run / Paper Mode | ✅ Default ON | ⚠️ Rarely included |

---

## Sponsor Tools Used

| Sponsor | Integration |
|---------|------------|
| **four.meme** | Core trading venue — token discovery, buy/sell execution, bonding curve data, holder metrics |
| **BNB Smart Chain** | `TradeLogger.sol` deployed on BSC — all AI decisions logged on-chain with full signal snapshot |
| **Elfa AI** | Social intelligence — token mention counts, engagement scores, and trending rank fed directly into the Gemini prompt |
| **Google Gemini 2.5 Flash** | AI reasoning engine — processes all signals and outputs structured BUY/SELL/HOLD decisions |

---

## Architecture

PacificaPilot runs **entirely on your local machine** — frontend, backend, and agent all local. Your private key is used only to sign transactions and is never transmitted anywhere. The only cloud component is MongoDB Atlas for trade history storage.

```
┌──────────────────────────────────────────────────────────────┐
│                   YOUR MACHINE  (All Components)             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   AGENT  (Python)                      │  │
│  │  • Scans four.meme tokens every cycle                  │  │
│  │  • Calls Elfa AI for social signals                    │  │
│  │  • Sends signals to Gemini 2.5 Flash                   │  │
│  │  • Executes trades on four.meme (BSC)                  │  │
│  │  • Logs decisions to TradeLogger.sol on BSC            │  │
│  │  • Private key never transmitted                       │  │
│  └──────────────────────┬─────────────────────────────────┘  │
│                         │  HTTP localhost:3001                │
│  ┌──────────────────────▼─────────────────────────────────┐  │
│  │           BACKEND  (Express — localhost:3001)           │  │
│  │           Config + Trade Logs + SSE streaming          │  │
│  └──────────────────────┬─────────────────────────────────┘  │
│                         │  localhost:5173                     │
│  ┌──────────────────────▼─────────────────────────────────┐  │
│  │           FRONTEND  (Vite — localhost:5173)             │  │
│  │           Dashboard · PnL · On-Chain Log Links         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
          │                              │
    MongoDB Atlas                  BNB Smart Chain
    (trade history)            (TradeLogger.sol — decisions)
```

| Component | Where It Runs | Notes |
|-----------|--------------|-------|
| Frontend (Vite) | Your machine — localhost:5173 | Dashboard UI |
| Backend (Express) | Your machine — localhost:3001 | API + SSE |
| Agent (Python) | Your machine | Trading logic + keys |
| MongoDB | Atlas (cloud) | Config + trade history |
| TradeLogger.sol | BSC Testnet / Mainnet | On-chain decision audit log |

---

## On-Chain Decision Logging

Every AI decision is logged permanently on BNB Smart Chain via `TradeLogger.sol`. This is the core trust mechanism of PacificaPilot.

### What Gets Logged On-Chain

| Field | Description |
|-------|-------------|
| `tokenAddress` | BSC contract address of the meme token |
| `action` | BUY / SELL / HOLD |
| `priceInWei` | Token price at decision time |
| `confidence` | Gemini's confidence score (0–100) |
| `socialScore` | Elfa AI engagement score |
| `mentionCount` | 24h mention count from Elfa |
| `holderCount` | On-chain holder count at decision time |
| `bondingCurvePct` | four.meme bonding curve fill % |
| `isTrending` | Whether token was in Elfa trending list |
| `reasoningHash` | `keccak256` of Gemini's full reasoning string |
| `dryRun` | True if paper trade |
| `timestamp` | Block timestamp |

### Tamper-Proof Reasoning Verification

The full Gemini reasoning text is stored in MongoDB. The `keccak256` hash of that text is stored on-chain. The dashboard calls `verifyReasoning()` on the contract to show a **✅ On-chain verified** badge, proving the reasoning was never altered after the decision was made.

```solidity
function verifyReasoning(uint256 id, string calldata reasoning)
    external view returns (bool)
```

---

## AI Decision Engine

Gemini 2.5 Flash receives a structured prompt with all signals and returns a JSON decision:

```json
{
  "action": "BUY",
  "confidence": 78,
  "size_pct": 75,
  "reasoning": "Token is 42% through bonding curve with strong buy pressure (31 buys vs 4 sells in 1h). Elfa engagement score of 7,200 and trending rank #3 signal genuine social momentum. Top-10 holder concentration is 38% — acceptable risk.",
  "primary_signal": "bonding_curve_momentum + elfa_trending",
  "risk_flags": []
}
```

### Signal Reference

| Signal | Source | Bullish | Bearish |
|--------|--------|---------|---------|
| Bonding Curve % | four.meme | 30–80% filling fast | <5% or stalled at 95%+ |
| Buy/Sell Ratio (1h) | BSC on-chain | >3:1 buys | >2:1 sells |
| Elfa Engagement | Elfa AI | Score >5000 | Score <1000 |
| Mention Count (24h) | Elfa AI | >100 for new token | <10 |
| Trending | Elfa AI | Ranked in top 10 | Not trending |
| Holder Concentration | BSC on-chain | Top-10 <40% | Top-10 >60% |
| Liquidity Pool | four.meme | >$10,000 | <$3,000 |
| Launch Age | four.meme | 10–60 min (sweet spot) | <5 min or >6h |

### Rug Detection Rules (Auto-HOLD)

The agent automatically outputs HOLD regardless of other signals if:
- Top-10 wallets hold >60% of supply **AND** token launched <15 minutes ago
- Liquidity pool is below $3,000
- Gemini confidence is below 50%

### Risk Profiles

| Profile | Stop Loss | Take Profit | Min Confidence |
|---------|-----------|-------------|----------------|
| Conservative | 5% | 15% | 75% |
| Balanced (default) | 10% | 25% | 60% |
| Aggressive | 20% | 50% | 45% |

---

## Features

### 📊 Live Dashboard (4 tabs)

- **Portfolio** — open positions, wallet balance, unrealized PnL per token, BscScan links for each on-chain log entry
- **Decisions** — every AI decision with full reasoning, confidence, risk flags, and on-chain verification badge
- **Logs** — live SSE stream of all agent activity with text filtering
- **Config** — edit all trading parameters from the browser; agent picks up changes on next cycle without restart

### 🔒 Non-Custodial Security

- Private key stored only in your local `agent/.env`, used only to sign BSC transactions on your machine
- Backend stores no private keys
- Agent authenticates to backend via shared `x-agent-key` secret

### ⚙️ Risk Management

- Rug detection: concentration check, liquidity floor, launch-age gate
- Trailing stop-loss with high-water mark tracking
- Hard position size cap (configurable, default $20 USDC equivalent in BNB)
- Minimum AI confidence gate — no trade below your threshold
- Dry run mode ON by default — zero real orders until you explicitly disable it

### 🔄 Multi-Token Parallel Execution

- Independent decision loops per token
- Each token has its own position state and trailing stop tracker
- State persists across restarts via `positions.json`

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI framework |
| Vite | 8.x | Build tool |
| ethers.js | 6.x | BSC wallet connection + contract reads |
| React Router | 7.x | Client-side routing |
| Framer Motion | 12.x | Animations |
| Tailwind CSS | 4.x | Styling |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | 5.x | REST API + SSE |
| MongoDB Atlas + Mongoose | 9.x | Database + ODM |

### Trading Agent
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11+ | Runtime |
| google-generativeai | 1.0+ | Gemini AI integration |
| web3.py | 6.x | BSC interaction + TradeLogger.sol calls |
| requests | 2.31+ | HTTP client for four.meme + Elfa APIs |
| python-dotenv | 1.0+ | Environment config |

### Smart Contract
| Technology | Purpose |
|------------|---------|
| Solidity ^0.8.20 | TradeLogger.sol — on-chain decision audit log |
| BSC Testnet / Mainnet | Deployment target |
| BscScan | Contract verification |

### External APIs
| Service | Purpose |
|---------|---------|
| **four.meme** | Meme token trading, bonding curve data, holder metrics |
| **Elfa AI** | Social sentiment — Twitter/X mentions and engagement |
| **Google Gemini 2.5 Flash** | AI trading decisions |
| **BNB Smart Chain (BSC)** | On-chain decision logging via TradeLogger.sol |
| **Binance** | BNB/USD price reference |

---

## Getting Started

### Prerequisites

- [four.meme account](https://four.meme) on BSC
- [Google Gemini API key](https://aistudio.google.com/app/apikey)
- [Elfa AI API key](https://elfa.ai) *(strongly recommended — core signal source)*
- [MongoDB Atlas account](https://mongodb.com/atlas) — free M0 cluster is sufficient
- Node.js 18+ and Python 3.11+
- MetaMask wallet with BSC Testnet configured and test BNB

### 1. Clone

```bash
git clone https://github.com/MayurK-cmd/Pacifica-Trading-Bot.git
cd Pacifica-Trading-Bot
```

### 2. Install Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../agent && pip install -r requirements.txt
```

### 3. Deploy TradeLogger.sol to BSC Testnet

```bash
# Using Remix IDE (easiest):
# 1. Open remix.ethereum.org
# 2. Paste contracts/TradeLogger.sol
# 3. Compile with Solidity 0.8.20
# 4. Deploy to BSC Testnet (Chain ID: 97)
# 5. Copy the deployed contract address

# Or using Hardhat:
cd contracts
npm install
npx hardhat run scripts/deploy.js --network bscTestnet
```

After deploying, verify on BscScan Testnet and copy the contract address into your `agent/.env`.

### 4. Configure Environment Files

**`backend/.env`**
```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/pacifica-pilot
AGENT_API_SECRET=<secure_random_string>
```

**`frontend/.env`**
```env
VITE_API_URL=http://localhost:3001
VITE_TRADE_LOGGER_ADDRESS=<your_deployed_contract_address>
VITE_BSC_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
```

**`agent/.env`**
```env
BACKEND_URL=http://localhost:3001
AGENT_API_SECRET=<same_as_backend>

# BSC / four.meme
BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
BSC_PRIVATE_KEY=<your_bsc_wallet_private_key>
TRADE_LOGGER_ADDRESS=<your_deployed_contract_address>
FOURMEME_BASE_URL=https://four.meme/api

# AI
GEMINI_API_KEY=<your_gemini_key>
ELFA_API_KEY=<your_elfa_key>

# Trading
DRY_RUN=true
MIN_CONFIDENCE=60
MAX_POSITION_BNB=0.05
```

### 5. Run

```bash
# Terminal 1 — Backend
cd backend && npm start          # → http://localhost:3001

# Terminal 2 — Frontend
cd frontend && npm run dev       # → http://localhost:5173

# Terminal 3 — Agent
cd agent && python main.py
```

Open `http://localhost:5173`, connect your MetaMask wallet (BSC Testnet), configure your parameters, and watch the agent trade.

---

## Trading Logic

### Decision Cycle (per token, every 3 min by default)

```
SCAN four.meme for new/active tokens
  └─► FETCH on-chain metrics (price, bonding curve %, holders, liquidity)
        └─► FETCH Elfa sentiment (mentions, engagement, trending)
              └─► RUN rug detection checks
                    └─► PROMPT Gemini 2.5 Flash with all signals
                          └─► IF confidence > threshold AND no rug flags
                                └─► EXECUTE trade on four.meme (BSC)
                                      └─► LOG decision to TradeLogger.sol (BSC)
                                            └─► TRACK position → close on SL/TP
                                                  └─► LOG exit decision on-chain
```

---

## Smart Contract Reference

**TradeLogger.sol** — deployed on BSC

```solidity
// Log a decision (called by the agent after every Gemini response)
function logDecision(
    string  calldata tokenSymbol,
    address          tokenAddress,
    string  calldata action,          // "BUY" | "SELL" | "HOLD"
    uint256          priceInWei,
    int256           pnlUsdc,
    uint8            confidence,
    uint32           socialScore,
    uint32           mentionCount,
    uint16           holderCount,
    uint8            bondingCurvePct,
    bool             isTrending,
    string  calldata reasoning,       // hashed on-chain via keccak256
    bool             dryRun
) external onlyAgent returns (uint256 id)

// Verify the full reasoning text matches the on-chain hash
function verifyReasoning(uint256 id, string calldata reasoning)
    external view returns (bool)

// Get the last N decisions (newest first) — used by the dashboard
function getRecentDecisions(uint256 count)
    external view returns (Decision[] memory)
```

---

## Configuration Reference

All parameters editable live from the **Config tab** — no agent restart needed.

| Parameter | Default | Description |
|-----------|---------|-------------|
| Tokens | Auto-scan | four.meme token addresses or "auto" for new launches |
| Loop Interval | 180s | Seconds between decision cycles per token |
| Max Position | 0.05 BNB | Hard cap per trade |
| Min Confidence | 60% | AI confidence gate |
| Stop Loss | 10% | Trailing stop distance |
| Take Profit | 25% | Exit target |
| Risk Level | Balanced | conservative / balanced / aggressive |
| Dry Run | true | Paper trade with real market data |
| Min Liquidity | $3,000 | Skip tokens below this liquidity |
| Max Holder Concentration | 60% | Skip if top-10 wallets hold more than this |

---

## API Reference

### Agent Routes (`x-agent-key` header)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent/config` | Pull current config |
| POST | `/api/agent/heartbeat` | Send liveness ping |
| POST | `/api/trades` | Log executed trade + PnL |
| POST | `/api/logs` | Push log entry |

### User Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Fetch trading config |
| POST | `/api/config` | Update trading config |
| GET | `/api/trades` | Full trade history |
| GET | `/api/trades/stats` | Aggregated PnL stats |
| GET | `/api/portfolio` | Open positions + balances |

### Public Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent/status` | Agent online / offline |
| GET | `/api/logs/stream` | SSE live log stream |

---

## Project Structure

```
pacifica-pilot/
├── contracts/
│   └── TradeLogger.sol          # On-chain decision logger (BSC)
│
├── agent/                       # Python trading agent
│   ├── main.py                 # Main loop
│   ├── executor.py             # four.meme order execution
│   ├── market.py               # four.meme market data + bonding curve
│   ├── sentiment.py            # Elfa AI sentiment
│   ├── strategy.py             # Gemini AI decisions + prompt
│   ├── onchain.py              # TradeLogger.sol interaction (web3.py)
│   └── logger.py               # Log streaming
│
├── backend/                     # Node.js Express API
│   ├── index.js
│   ├── models/
│   ├── routes/
│   └── middleware/
│
├── frontend/                    # React + Vite
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Dashboard.jsx
│   │   ├── LoginPage.jsx        # MetaMask / BSC wallet connect
│   │   └── tabs/               # Portfolio, Config, Decisions, Logs
│   └── vite.config.js
│
├── requirements.txt
└── README.md
```

---

## Security Model

| Asset | Where It Lives | Protection |
|-------|---------------|------------|
| BSC private key | Your local `agent/.env` | Never transmitted |
| User wallet | Browser (MetaMask) | Non-custodial |
| Trade history | MongoDB Atlas | Cloud DB, no keys stored |
| Agent ↔ Backend | `x-agent-key` over HTTP | Shared secret |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Agent shows Offline | Toggle "Enabled" ON in Config tab |
| TradeLogger tx fails | Check BSC RPC URL and wallet has test BNB for gas |
| No four.meme data | Check token address is valid and on BSC |
| Elfa returns empty | Verify API key; new tokens may have <24h of data |
| MetaMask not connecting | Ensure BSC Testnet (Chain ID 97) is added to MetaMask |
| PnL not updating | Confirm agent is running and heartbeating; check Logs tab |

Enable verbose logging:
```python
# agent/main.py
DEBUG = True
```

---

## Contributing

1. Fork the repo
2. `git checkout -b feature/your-feature`
3. `git commit -am 'Add feature'`
4. `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE)

---

## Acknowledgements

Built for the [four.meme AI Sprint](https://dorahacks.io/hackathon/fourmemeaisprint) — April 2026.

| Tool | Role |
|------|------|
| [four.meme](https://four.meme) | Meme token launchpad + trading API |
| [BNB Smart Chain](https://bnbchain.org) | On-chain decision logging |
| [Elfa AI](https://elfa.ai) | Social sentiment intelligence |
| [Google Gemini](https://ai.google.dev) | AI reasoning engine |

---

## Disclaimer

Meme token trading involves extreme volatility and substantial risk of total loss. Always run in **dry run mode** first. Past strategy performance does not guarantee future results. You are solely responsible for your trading decisions.