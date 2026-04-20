# 4MemePilot Frontend

React + Vite dashboard for the 4MemePilot AI trading agent.

## Features

- **Portfolio Tab**: Trading statistics, watchlist management, recent trades
- **Config Tab**: Agent configuration, risk parameters, scan mode selection
- **Decisions Tab**: AI trading decision history with filtering
- **Logs Tab**: Real-time agent activity streaming

## Tech Stack

- **React 18** with hooks
- **Vite** for build tooling
- **Tailwind CSS v4** for styling (BNB Chain brand colors)
- **Framer Motion** for animations
- **Privy** for wallet authentication
- **React Router** for navigation

## Color Scheme

| Color | Hex | Usage |
|-------|-----|-------|
| BNB Gold | `#F0B90B` | Primary accent, buttons, highlights |
| BNB Dark | `#0B0E11` | Background surfaces |
| BNB Dark Blue | `#181D2B` | Borders, dividers |
| Success | `#22c55e` | Buy signals, profits |
| Danger | `#ef4444` | Sell signals, losses |

## Getting Started

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## Environment Variables

```bash
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_API_URL=http://localhost:3001
VITE_LOGO_DEV_API_KEY=your_logo_dev_key
VITE_BSC_RPC_URL=https://bsc-testnet-dataseed.bnbchain.org
VITE_TRADE_LOGGER_ADDRESS=0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B  # BSC Testnet
```

## Component Structure

```
src/
├── pages/
│   ├── Dashboard.jsx      # Main app layout
│   ├── LandingPage.jsx    # Landing page
│   ├── LoginPage.jsx      # Privy login
│   └── Onboarding.jsx     # Wallet setup
├── tabs/
│   ├── PortfolioTab.jsx   # Trading stats & watchlist
│   ├── ConfigTab.jsx      # Agent settings
│   ├── DecisionsTab.jsx   # Decision history
│   └── LogsTab.jsx        # Live logs
├── components/
│   └── AgentStatusBar.jsx # Agent status indicator
└── useApi.js              # API client hook
```
