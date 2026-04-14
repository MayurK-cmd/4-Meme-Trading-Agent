const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  privyUserId:      { type: String, required: true, unique: true },
  email:            { type: String, default: null },
  walletAddress:    { type: String, default: null },  // BSC address from Privy

  // BSC wallet for 4.meme trading (encrypted)
  // Note: For security, private keys should be stored encrypted or use Privy custody
  bscAddress:        { type: String, default: null },  // BSC trading wallet address
  bscPrivateKeyEnc:  { type: String, default: null },  // Encrypted private key

  // Legacy Pacifica fields (kept for backwards compatibility)
  pacificaAddress:   { type: String, default: null },
  pacificaPrivateKey:{ type: String, default: null },
  pacificaApiKey:    { type: String, default: null },

  onboarded:        { type: Boolean, default: false }, // true once wallet is saved
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
