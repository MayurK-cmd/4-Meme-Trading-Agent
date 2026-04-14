const express = require("express");
const router  = express.Router();
const { requireAuth } = require("../middleware/auth");
const Config = require("../models/Config");

// All config routes require auth
router.use(requireAuth);

// GET /api/config
router.get("/", async (req, res) => {
  try {
    let cfg = await Config.findOne({ userId: req.user._id });
    if (!cfg) cfg = await Config.create({ userId: req.user._id });
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/config
router.post("/", async (req, res) => {
  try {
    const allowed = [
      // 4.meme specific fields
      "scanMode", "watchlist", "maxPositionBnb", "maxPositionUsd",
      "minLiquidityUsd", "maxRugRisk", "bcMinPct", "bcMaxPct", "maxOpenPositions",
      // Legacy/general fields
      "symbols", "loopIntervalSeconds", "minConfidence",
      "dryRun", "riskLevel", "enabled", "stopLossPct", "takeProfitPct", "useBinanceFallback",
    ];
    const update = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }

    // Validation and sanitization
    if (update.scanMode && !["trending", "new", "watchlist"].includes(update.scanMode)) {
      delete update.scanMode;
    }
    if (update.watchlist && Array.isArray(update.watchlist)) {
      update.watchlist = update.watchlist
        .filter(addr => addr.match(/^0x[a-fA-F0-9]{40}$/))  // Valid BSC address
        .slice(0, 20);  // Max 20 tokens in watchlist
    }
    if (update.maxPositionBnb) update.maxPositionBnb = Math.max(0.001, Math.min(10, +update.maxPositionBnb));
    if (update.maxPositionUsd) update.maxPositionUsd = Math.max(10, Math.min(10000, +update.maxPositionUsd));
    if (update.minConfidence) update.minConfidence = Math.max(0.3, Math.min(0.95, +update.minConfidence));
    if (update.stopLossPct) update.stopLossPct = Math.max(0.5, Math.min(20, +update.stopLossPct));
    if (update.takeProfitPct) update.takeProfitPct = Math.max(1, Math.min(50, +update.takeProfitPct));
    if (update.minLiquidityUsd) update.minLiquidityUsd = Math.max(1000, Math.min(100000, +update.minLiquidityUsd));
    if (update.maxRugRisk) update.maxRugRisk = Math.max(0, Math.min(100, +update.maxRugRisk));
    if (update.bcMinPct) update.bcMinPct = Math.max(0, Math.min(50, +update.bcMinPct));
    if (update.bcMaxPct) update.bcMaxPct = Math.max(50, Math.min(100, +update.bcMaxPct));
    if (update.maxOpenPositions) update.maxOpenPositions = Math.max(1, Math.min(10, +update.maxOpenPositions));
    if (update.loopIntervalSeconds) update.loopIntervalSeconds = Math.max(60, Math.min(3600, +update.loopIntervalSeconds));
    if (update.symbols) {
      update.symbols = update.symbols.map(s => String(s).toUpperCase().trim()).filter(Boolean).slice(0, 10);
    }

    const cfg = await Config.findOneAndUpdate(
      { userId: req.user._id }, { $set: update }, { new: true, upsert: true }
    );
    res.json(cfg);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
