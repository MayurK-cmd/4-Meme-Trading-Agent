const mongoose = require("mongoose");

const tradeSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

  // Token info
  symbol:           { type: String, required: true },
  tokenAddress:     { type: String, default: null },  // BSC contract address

  // Decision
  action:           { type: String, enum: ["BUY", "SELL", "HOLD"], required: true },
  confidence:       { type: Number, default: 0.5 },
  size_pct:         { type: Number, default: 0.5 },
  reasoning:        { type: String, default: "" },

  // Market data at decision time
  price_usd:        { type: Number, default: 0 },
  bonding_curve_pct:{ type: Number, default: 0 },
  liquidity_usd:    { type: Number, default: 0 },
  holder_count:     { type: Number, default: 0 },
  rug_risk_score:   { type: Number, default: 0 },

  // Sentiment data
  sentiment_score:  { type: Number, default: 0 },
  mention_count:    { type: Number, default: 0 },
  trending_score:   { type: Number, default: 0 },

  // Order result
  order:            { type: Object, default: null },  // Full order result from executor

  // PnL
  pnl_usdc:         { type: Number, default: 0 },

  // Metadata
  dry_run:          { type: Boolean, default: true },
  timestamp:        { type: Date, default: Date.now, index: true },
}, { timestamps: true });

// Index for efficient queries
tradeSchema.index({ userId: 1, timestamp: -1 });
tradeSchema.index({ symbol: 1, timestamp: -1 });

module.exports = mongoose.model("Trade", tradeSchema);
