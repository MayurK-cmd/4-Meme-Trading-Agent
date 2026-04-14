const express  = require("express");
const router   = express.Router();
const mongoose = require("mongoose");
const { requireAuth } = require("../middleware/auth");
const Trade = require("../models/Trade");

// GET /api/trades - requires JWT
router.get("/", requireAuth, async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.symbol) filter.symbol = req.query.symbol.toUpperCase();
    if (req.query.action) filter.action = req.query.action.toUpperCase();

    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const skip  = parseInt(req.query.skip) || 0;

    const [trades, total] = await Promise.all([
      Trade.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Trade.countDocuments(filter),
    ]);
    res.json({ total, limit, skip, trades });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/trades/stats - requires JWT
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const uid = req.user._id;
    const [total, byAction, withPnl] = await Promise.all([
      Trade.countDocuments({ userId: uid }),
      Trade.aggregate([{ $match: { userId: uid } }, { $group: { _id: "$action", count: { $sum: 1 } } }]),
      Trade.find({ userId: uid, pnl_usdc: { $ne: null } }).select("pnl_usdc").lean(),
    ]);
    const totalPnl = withPnl.reduce((s, t) => s + (t.pnl_usdc || 0), 0);
    res.json({
      totalDecisions: total,
      byAction: Object.fromEntries(byAction.map(r => [r._id, r.count])),
      totalPnlUsdc: parseFloat(totalPnl.toFixed(4)),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/trades/:id - requires JWT
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const trade = await Trade.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!trade) return res.status(404).json({ error: "Not found" });
    res.json(trade);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/trades — called by Python agent (uses x-agent-key, not JWT)
// Agent passes userId in the body so we can scope it correctly
router.post("/", async (req, res) => {
  try {
    const { symbol, action, userId } = req.body;
    if (!symbol || !action || !userId) {
      return res.status(400).json({ error: "symbol, action and userId are required" });
    }
    const trade = await Trade.create(req.body);
    res.status(201).json(trade);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
