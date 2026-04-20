# 4MemePilot Documentation

## 📚 Overview

4MemePilot is an autonomous AI trading bot for the 4.meme memecoin launchpad on BNB Chain.

## 📖 Contents

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System design and component breakdown |
| [API Reference](./API_REFERENCE.md) | 4.meme API endpoints and usage |
| [Smart Contracts](../contracts/README.md) | TradeLogger contract details |
| [Configuration](./CONFIGURATION.md) | Environment variables and settings |
| [Trading Strategy](./TRADING_STRATEGY.md) | AI decision framework |

## 🔗 External Resources

- [4.meme Official](https://four.meme)
- [BNB Chain Docs](https://docs.bnbchain.org)
- [Elfa AI API](https://elfa.ai)
- [Google Gemini API](https://ai.google.dev)
- [DoraHacks 4-meme AI Sprint](https://dorahacks.io/hackathon/fourmemeaisprint/detail)

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/MayurK-cmd/four-meme-BNB.git
cd four-meme-BNB

# Install agent dependencies
cd agent
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run in dry-run mode
python main.py
```

## ⚠️ Warning

**Memecoin trading is extremely risky.** Always start with `DRY_RUN=true` and never trade more than you can afford to lose.
