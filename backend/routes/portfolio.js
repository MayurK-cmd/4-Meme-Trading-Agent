const express = require("express");
const router  = express.Router();
const { requireAuth } = require("../middleware/auth");
const User = require("../models/User");
const Trade = require("../models/Trade");  // Assuming you have a Trade model

router.use(requireAuth);

// GET /api/portfolio
// Returns BSC wallet holdings and trading stats for 4.meme
router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const bscAddress = user.bscAddress;

    if (!bscAddress) {
      return res.status(400).json({
        error: "BSC wallet address not configured.",
        hint:  "Complete onboarding to add your BSC wallet address.",
      });
    }

    // Fetch trade history from MongoDB
    const trades = await Trade.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    // Calculate stats
    const totalTrades = trades.length;
    const buyTrades = trades.filter(t => t.action === "BUY").length;
    const sellTrades = trades.filter(t => t.action === "SELL").length;

    // Calculate realized PnL (sum of all SELL PnL values)
    const totalRealizedPnl = trades
      .filter(t => t.action === "SELL" && t.pnl_usdc)
      .reduce((sum, t) => sum + (parseFloat(t.pnl_usdc) || 0), 0);

    // Get unique tokens traded
    const tokensTraded = [...new Set(trades.map(t => t.symbol).filter(Boolean))];

    // Calculate win rate (profitable sells / total sells)
    const profitableSells = trades
      .filter(t => t.action === "SELL" && (parseFloat(t.pnl_usdc) || 0) > 0)
      .length;
    const winRate = sellTrades > 0 ? (profitableSells / sellTrades) * 100 : 0;

    // Recent decisions (last 20)
    const recentDecisions = trades.slice(0, 20).map(t => ({
      symbol: t.symbol,
      action: t.action,
      confidence: t.confidence,
      reasoning: t.reasoning,
      price_usd: t.price_usd,
      pnl_usdc: t.pnl_usdc,
      dry_run: t.dry_run,
      timestamp: t.timestamp,
    }));

    res.json({
      bscAddress,

      // Trading stats
      totalTrades,
      buyTrades,
      sellTrades,
      totalRealizedPnl,
      winRate: Math.round(winRate * 100) / 100,
      tokensTraded,

      // Recent decisions
      recentDecisions,

      // Note: For live token holdings, the agent reads directly from BSC
      // The frontend can use viem/wagmi to fetch on-chain balances
      holdingsNote: "Token holdings are fetched on-chain via viem/wagmi in the frontend",
    });
  } catch (e) {
    console.error("Portfolio API Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
