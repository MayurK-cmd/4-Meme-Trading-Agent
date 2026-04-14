const express = require("express");
const router  = express.Router();
const { requireAuth } = require("../middleware/auth");
const { encrypt, decrypt } = require("../middleware/crypto");
const User = require("../models/User");

// POST /api/auth/sync
// Called by frontend right after Privy login — syncs email + wallet into our DB
router.post("/sync", requireAuth, async (req, res) => {
  try {
    const { email, walletAddress } = req.body;
    const update = {};
    if (email)         update.email         = email;
    if (walletAddress) update.walletAddress  = walletAddress;

    const user = await User.findByIdAndUpdate(
      req.user._id, { $set: update }, { new: true }
    ).select("-bscPrivateKeyEnc");

    res.json({ user, onboarded: user.onboarded });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/keys
// Saves encrypted BSC private key — onboarding step for 4.meme trading
router.post("/keys", requireAuth, async (req, res) => {
  try {
    const { bscPrivateKey, bscAddress } = req.body;

    if (!bscAddress || !bscAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: "Invalid BSC address" });
    }
    if (!bscPrivateKey) {
      return res.status(400).json({ error: "bscPrivateKey is required" });
    }

    const update = {
      bscAddress,                                 // plain — it's a public key
      bscPrivateKeyEnc: encrypt(bscPrivateKey),   // encrypted private key
      onboarded: true,
    };

    await User.findByIdAndUpdate(req.user._id, { $set: update });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me
// Returns current user's profile (no keys)
router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("-bscPrivateKeyEnc");
  res.json(user);
});

// POST /api/auth/wallet
// Just saves BSC wallet address (for users who want to add wallet later)
router.post("/wallet", requireAuth, async (req, res) => {
  try {
    const { bscAddress } = req.body;
    if (!bscAddress || !bscAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: "Invalid BSC address" });
    }
    await User.findByIdAndUpdate(req.user._id, { $set: { bscAddress } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
