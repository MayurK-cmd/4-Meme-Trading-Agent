const mongoose = require("mongoose");

const configSchema = new mongoose.Schema({
  userId:              { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },

  // 4.meme specific settings (replaces Pacifica perpetuals)
  scanMode:            { type: String, enum: ["trending", "new", "watchlist"], default: "trending" },
  watchlist:           { type: [String], default: [] },  // Token addresses to watch

  // Risk management
  maxPositionBnb:      { type: Number, default: 0.1 },   // Max BNB per trade
  maxPositionUsd:      { type: Number, default: 60 },    // USD equivalent
  minConfidence:       { type: Number, default: 0.55 },  // Min AI confidence (0-1)
  stopLossPct:         { type: Number, default: 5.0 },   // Stop-loss percentage
  takeProfitPct:       { type: Number, default: 10.0 },  // Take-profit percentage

  // Filtering criteria
  minLiquidityUsd:     { type: Number, default: 5000 },  // Min liquidity filter
  maxRugRisk:          { type: Number, default: 50 },    // Max rug risk score (0-100)
  bcMinPct:            { type: Number, default: 20 },    // Min bonding curve %
  bcMaxPct:            { type: Number, default: 80 },    // Max bonding curve %

  // General settings
  maxOpenPositions:    { type: Number, default: 3 },     // Max concurrent positions
  loopIntervalSeconds: { type: Number, default: 300 },   // Cycle interval
  dryRun:              { type: Boolean, default: true }, // Simulation mode
  enabled:             { type: Boolean, default: false },// Agent enabled flag

  // Legacy Pacifica fields (kept for backwards compatibility)
  symbols:             { type: [String], default: [] },
  riskLevel:           { type: String, enum: ["conservative", "balanced", "aggressive"], default: "balanced" },
  useBinanceFallback:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Config", configSchema);
