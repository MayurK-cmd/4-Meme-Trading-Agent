const express  = require("express");
const cors     = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const authRouter      = require("./routes/auth");
const configRouter    = require("./routes/config");
const tradesRouter    = require("./routes/trades");
const agentRouter     = require("./routes/agent");
const portfolioRouter = require("./routes/portfolio");
const { router: logsRouter } = require("./routes/logs");

const User   = require("./models/User");
const Config = require("./models/Config");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Agent key middleware ───────────────────────────────────────────────────────
const AGENT_SECRET = process.env.AGENT_API_SECRET || "";

function requireAgentKey(req, res, next) {
  if (!AGENT_SECRET) {
    return res.status(500).json({ error: "AGENT_API_SECRET not configured on server" });
  }
  const key = req.headers["x-agent-key"] || req.query.key;
  if (!key || key !== AGENT_SECRET) {
    return res.status(401).json({ error: "Unauthorized — invalid agent key" });
  }
  next();
}

// ── GET /api/agent/config ──────────────────────────────────────────────────────
// Called by the Python agent every loop to get:
//   - enabled flag (user toggled from frontend)
//   - walletAddress (BSC address for 4.meme trading)
//   - all trading params (scan mode, risk settings, filters)
// Protected by x-agent-key header only — no JWT needed
app.get("/api/agent/config", requireAgentKey, async (req, res) => {
  try {
    // Single-user setup: find the one onboarded user
    const user = await User.findOne({ onboarded: true }).lean();
    if (!user) {
      return res.json({
        enabled: false,
        reason:  "No onboarded user found — complete onboarding first",
      });
    }

    const cfg = await Config.findOne({ userId: user._id }).lean();
    if (!cfg) {
      return res.json({
        enabled: false,
        reason:  "No config found for user",
      });
    }

    if (!user.bscAddress) {
      return res.json({
        enabled: false,
        reason:  "User has no BSC wallet address saved — complete onboarding",
      });
    }

    res.json({
      // Agent control
      enabled:             cfg.enabled !== false,  // Default to true if not set
      walletAddress:       user.bscAddress,        // BSC address for 4.meme
      dryRun:              cfg.dryRun !== false,   // Default to true (safe)

      // 4.meme scan settings
      scanMode:            cfg.scanMode || "trending",
      watchlist:           cfg.watchlist || [],

      // Position sizing
      maxPositionBnb:      cfg.maxPositionBnb || 0.1,
      maxPositionUsd:      cfg.maxPositionUsd || 60,
      maxOpenPositions:    cfg.maxOpenPositions || 3,

      // Risk management
      minConfidence:       cfg.minConfidence || 0.55,
      stopLossPct:         cfg.stopLossPct || 5.0,
      takeProfitPct:       cfg.takeProfitPct || 10.0,

      // Filtering criteria
      minLiquidityUsd:     cfg.minLiquidityUsd || 5000,
      maxRugRisk:          cfg.maxRugRisk || 50,
      bondingCurveRange:   [cfg.bcMinPct || 20, cfg.bcMaxPct || 80],

      // Loop timing
      loopIntervalSeconds: cfg.loopIntervalSeconds || 300,

      // Legacy fields (for backwards compatibility)
      symbols:             cfg.symbols || [],
      riskLevel:           cfg.riskLevel || "balanced",
      useBinanceFallback:  cfg.useBinanceFallback !== false,
    });
  } catch (e) {
    console.error("[/api/agent/config]", e.message);
    res.status(500).json({ enabled: false, error: e.message });
  }
});

// ── Public auth routes ─────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);

// ── Per-user routes (JWT verified inside each router) ─────────────────────────
app.use("/api/config",    configRouter);
app.use("/api/trades",    tradesRouter);
app.use("/api/portfolio", portfolioRouter);

// ── Agent routes ───────────────────────────────────────────────────────────────
// POST requires agent key, GET is open (frontend polls /status freely)
app.use("/api/agent", (req, res, next) => {
  if (req.method === "POST") return requireAgentKey(req, res, next);
  next();
}, agentRouter);

// ── GET /api/agent/user-id — agent fetches userId on startup ─────────────────
app.get("/api/agent/user-id", requireAgentKey, async (req, res) => {
  try {
    const user = await User.findOne({ onboarded: true }).select("_id").lean();
    if (!user) return res.status(404).json({ error: "No onboarded user found" });
    res.json({ userId: user._id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/agent/wallet — agent fetches wallet credentials ──────────────────
// Returns decrypted BSC wallet credentials for trading
// Protected by requireAgentKey — only the agent can access this
app.get("/api/agent/wallet", requireAgentKey, async (req, res) => {
  try {
    const { decrypt } = require("./middleware/crypto");
    const user = await User.findOne({ onboarded: true }).lean();
    if (!user) return res.status(404).json({ error: "No onboarded user found" });

    if (!user.bscAddress || !user.bscPrivateKeyEnc) {
      return res.status(400).json({ error: "Wallet not configured — complete onboarding" });
    }

    res.json({
      walletAddress: user.bscAddress,
      privateKey: decrypt(user.bscPrivateKeyEnc),
    });
  } catch (e) {
    console.error("[/api/agent/wallet]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Logs routes ────────────────────────────────────────────────────────────────
// POST requires agent key, GET + SSE stream are open
app.use("/api/logs", (req, res, next) => {
  if (req.method === "POST") return requireAgentKey(req, res, next);
  next();
}, logsRouter);

// ── Health ─────────────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ── DB + Start ─────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("[DB] Connected");
    app.listen(PORT, () => console.log(`[Server] Port ${PORT}`));
  })
  .catch((e) => {
    console.error("[DB] Failed:", e.message);
    process.exit(1);
  });
