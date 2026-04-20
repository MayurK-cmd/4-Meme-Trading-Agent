import { useState } from "react";
import { useApi } from "../useApi";

export default function OnboardingPage({ onDone }) {
  const api = useApi();
  const [bscAddress, setBscAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const BSC_GOLD = "#F0B90B"; // BNB Chain official gold

  async function submit() {
    if (!bscAddress.trim()) { setError("BSC wallet address is required"); return; }
    if (!privateKey.trim()) { setError("BSC private key is required"); return; }
    if (!bscAddress.startsWith("0x") || bscAddress.length !== 42) {
      setError("Invalid BSC address format (must be 0x...40 hex chars)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/api/auth/keys", {
        bscAddress: bscAddress.trim(),
        bscPrivateKey: privateKey.trim(),
      });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#020408] text-zinc-300 font-mono p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full border border-[#1a2b3b] bg-zinc-900/10 p-8 md:p-12 shadow-2xl">
        <h2 className="text-white text-xl font-bold uppercase tracking-tighter mb-4 italic">Initialize_Account</h2>
        <p className="text-xs text-zinc-500 mb-10 leading-relaxed uppercase tracking-tight">
          Your BSC wallet keys are AES-256 encrypted before storage. They never leave the secure environment in plain text.
        </p>

        <div className="space-y-8">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-zinc-500">BSC Wallet Address *</label>
            <input
              type="text"
              className="bg-transparent border border-[#1a2b3b] p-3 text-sm focus:border-[#F0B90B] outline-none transition-colors"
              placeholder="0x..."
              value={bscAddress}
              onChange={e => setBscAddress(e.target.value)}
            />
            <small className="text-[9px] text-zinc-600">Your BNB Smart Chain wallet address (MetaMask, Trust Wallet, etc.)</small>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-zinc-500">BSC Private Key *</label>
            <input
              type="password"
              className="bg-transparent border border-[#1a2b3b] p-3 text-sm focus:border-[#F0B90B] outline-none transition-colors font-sans"
              placeholder="0x..."
              value={privateKey}
              onChange={e => setPrivateKey(e.target.value)}
            />
            <small className="text-[9px] text-zinc-600 italic">Export from MetaMask: Settings → Security & Privacy → Reveal Secret Recovery Phrase</small>
          </div>
        </div>

        {error && <div className="mt-8 text-red-500 text-[10px] uppercase font-bold tracking-widest">Error: {error}</div>}

        <button
          onClick={submit}
          disabled={loading}
          className="mt-12 w-full text-black py-4 font-bold uppercase tracking-widest text-xs transition-all disabled:opacity-50 cursor-pointer"
          style={{ backgroundColor: BSC_GOLD }}
        >
          {loading ? "SAVING_ENCRYPTED_KEYS..." : "SAVE_AND_CONTINUE"}
        </button>
      </div>
    </div>
  );
}
