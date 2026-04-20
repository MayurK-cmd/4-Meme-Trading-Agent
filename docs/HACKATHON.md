# 4MemePilot - Hackathon Submission Guide

## 🏆 DoraHacks 4-meme AI Sprint

**Project:** 4MemePilot - AI-Powered Memecoin Trading Agent  
**Submission:** [DoraHacks 4-meme AI Sprint](https://dorahacks.io/hackathon/fourmemeaisprint/detail)  
**Track:** Trading Apps & Innovation  

---

## 🎬 Demo Video Script (Suggested Flow)

### 1. Introduction (30 seconds)
- Show landing page with BNB gold theme
- Explain: "4MemePilot is an autonomous AI agent for trading memecoins on 4.meme"
- Mention: "Powered by Gemini AI + Elfa social sentiment"

### 2. Wallet Connection (30 seconds)
- Click "Launch Agent" → Login with Privy
- Show testnet wallet connection
- Explain hybrid architecture: "TradeLogger on testnet, 4.meme trading on mainnet"

### 3. Onboarding (30 seconds)
- Enter BSC wallet address
- Explain: "Private keys are AES-256 encrypted before storage"

### 4. Config Tab (1 minute)
- Show scan modes: Trending, New Launches, Watchlist
- Adjust risk parameters: Stop Loss, Take Profit, Max Positions
- Show watchlist with token images
- Explain: "All config is stored in MongoDB, agent fetches every cycle"

### 5. Portfolio Tab (1 minute)
- Search for a memecoin (e.g., "PEPE")
- Show token images in search results
- Add to watchlist
- Show trading stats layout

### 6. Logs Tab (30 seconds)
- Show real-time log streaming
- Explain: "Every AI decision is logged to TradeLogger contract on BSC testnet"

### 7. Smart Contract (30 seconds)
- Open BSCScan testnet
- Show TradeLogger contract: `0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B`
- Explain: "Tamper-proof audit trail for all trading decisions"

### 8. Agent Demo (1 minute)
- Show agent running in terminal (DRY_RUN=true)
- Explain: "Analyzes bonding curves, Elfa sentiment, Gemini reasoning"
- Show sample decision output

### 9. Closing (30 seconds)
- Summary: "AI-powered, risk-aware, on-chain verified"
- Call to action: "Try it yourself - link in description"

---

## 🏗️ Architecture Highlights

### Hybrid Network Design

| Component | Network | Why |
|-----------|---------|-----|
| **TradeLogger Contract** | BSC Testnet (Chain ID: 97) | Low-cost gas for audit logging |
| **4.meme Trading** | BSC Mainnet (Chain ID: 56) | Real memecoin liquidity |
| **Wallet Auth (Privy)** | BSC Testnet | Test BNB for authentication |

### AI Decision Pipeline

```
4.meme API → Bonding Curve + Liquidity + Holders
     ↓
Elfa AI → Sentiment + Engagement + Trending
     ↓
Gemini 2.5 Flash → BUY/SELL/HOLD Decision
     ↓
Executor → TokenManager Contract (4.meme)
     ↓
TradeLogger → On-chain Audit (BSC Testnet)
```

---

## 🔗 Links for Judges

| Resource | URL |
|----------|-----|
| **GitHub Repo** | https://github.com/MayurK-cmd/four-meme-BNB |
| **Demo Video** | [Coming Soon] |
| **TradeLogger Contract** | https://testnet.bscscan.com/address/0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B |
| **4.meme Platform** | https://four.meme |
| **DoraHacks Submission** | https://dorahacks.io/hackathon/fourmemeaisprint/detail |

---

## 🎯 Judging Criteria Alignment

### Innovation (30%)
- ✅ First AI agent combining Gemini + Elfa for 4.meme trading
- ✅ Bonding curve analysis integrated with social sentiment
- ✅ Hybrid architecture (testnet logging + mainnet trading)

### Technical Implementation (30%)
- ✅ Full-stack: Python agent + React frontend + Node.js backend
- ✅ Smart contract for on-chain audit trail
- ✅ AES-256 encryption for private keys
- ✅ Parallel processing with ThreadPoolExecutor

### Practical Value (20%)
- ✅ Real 4.meme integration with TokenManager contracts
- ✅ Risk management: stop-loss, take-profit, position limits
- ✅ Rug detection: holder concentration, liquidity filters
- ✅ Dry-run mode for safe testing

### Presentation (20%)
- ✅ BNB Chain brand-aligned UI/UX
- ✅ Token images from 4.meme API
- ✅ Real-time log streaming
- ✅ Comprehensive documentation

---

## 🚀 Getting Started (For Judges)

```bash
# Clone repo
git clone https://github.com/MayurK-cmd/four-meme-BNB.git
cd four-meme-BNB

# Backend
cd backend
npm install
npm start  # Runs on http://localhost:3001

# Frontend (new terminal)
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173

# Agent (new terminal)
cd agent
pip install -r requirements.txt
python main.py  # DRY_RUN=true by default
```

---

## ⚠️ Important Notes

1. **Testnet Contract**: TradeLogger is on BSC testnet to save gas costs
2. **Mainnet Trading**: 4.meme API returns mainnet token data
3. **DRY_RUN Mode**: Enabled by default - no real BNB spent
4. **API Keys Required**: Gemini, Elfa, Privy (see `.env.example`)

---

## 📁 Submission Checklist

- [x] GitHub repository with code
- [ ] Demo video uploaded (YouTube/unlisted)
- [x] Working prototype (run locally)
- [x] Documentation (README.md, docs/)
- [x] Smart contract deployed (testnet)
- [x] DoraHacks submission form completed

---

**Built with ❤️ for the 4.meme AI Sprint 2026**
