# System Architecture

## High-Level Overview

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

## Components

### Agent (Python)

| Module | Purpose |
|--------|---------|
| `main.py` | Entry point, config fetching, cycle orchestration |
| `market.py` | 4.meme market data, bonding curve analysis |
| `sentiment.py` | Elfa AI social sentiment fetching |
| `strategy.py` | Gemini AI decision engine |
| `executor.py` | BSC trade execution, position management |
| `four_meme.py` | 4.meme API wrappers, contract interactions |
| `logger.py` | Decision logging to backend and chain |

### Frontend (React + Vite)

| Component | Purpose |
|-----------|---------|
| `Dashboard.jsx` | Main layout, tab navigation |
| `PortfolioTab.jsx` | Trading stats, watchlist management |
| `ConfigTab.jsx` | Agent configuration, risk parameters |
| `DecisionsTab.jsx` | AI decision history |
| `LogsTab.jsx` | Real-time agent activity stream |

### Backend (Node.js + Express)

| Route | Purpose |
|-------|---------|
| `/api/auth/*` | Privy authentication, user onboarding |
| `/api/config/*` | User trading configuration |
| `/api/portfolio/*` | Trading history and stats |
| `/api/trades/*` | Trade records |
| `/api/agent/*` | Agent control (config, wallet, status) |
| `/api/logs/*` | Agent log streaming |

### Smart Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| TradeLogger | `0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B` | On-chain decision audit |

## Data Flow

1. **Config Load**: Agent fetches config from backend DB on each cycle
2. **Token Scan**: Scans 4.meme for trending/new/watchlist tokens
3. **Market Data**: Fetches price, bonding curve, liquidity, holders
4. **Sentiment**: Fetches Elfa AI engagement scores
5. **AI Decision**: Gemini analyzes signals, returns BUY/SELL/HOLD
6. **Execution**: If confidence > threshold, executes via TokenManager
7. **Logging**: Decision logged to backend + TradeLogger contract
8. **Position Tracking**: Monitors open positions for exit conditions

## Security Model

- **Private Keys**: Encrypted with AES-256-CBC before DB storage
- **Decryption**: Only in runtime memory, never logged
- **Dry Run**: Default mode simulates trades without spending BNB
- **On-Chain Audit**: All decisions publicly verifiable on BSCScan
