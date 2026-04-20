import { useState, useEffect } from "react";
import { useApi } from "../useApi";
import { motion } from "framer-motion";

const BSC_GOLD = "#F0B90B"; // BNB Chain official gold

const SCAN_MODES = [
  { v: "trending", l: "TRENDING", desc: "Scan Elfa AI trending tokens" },
  { v: "new", l: "NEW LAUNCHES", desc: "Scan newly launched tokens" },
  { v: "watchlist", l: "WATCHLIST", desc: "Monitor specific tokens" },
];

const RISK_PROFILES = {
  conservative: { desc: "Lower risk, smaller positions", sl: "3%", tp: "8%", conf: "70%", liq: "$10K", rug: "30" },
  balanced: { desc: "Moderate risk, balanced approach", sl: "5%", tp: "12%", conf: "55%", liq: "$5K", rug: "50" },
  aggressive: { desc: "Higher risk, larger positions", sl: "8%", tp: "20%", conf: "40%", liq: "$3K", rug: "70" },
};

export default function ConfigTab() {
  const api = useApi();
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/api/config").then(setCfg).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/api/config", cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error("Config Sync Error:", e);
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-10 h-10 border-2 border-[#1a2b3b] border-t-[#F3BA2F] rounded-full"
      />
      <div className="font-mono text-zinc-500 animate-pulse uppercase tracking-[0.3em] text-xs">
        Synchronizing_Protocol_Invariants...
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl space-y-20 pb-32">

      {/* 1. Safety Notice */}
      <div className="border border-yellow-900/50 bg-yellow-900/5 p-6 font-mono relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-yellow-600" />
        <div className="flex items-center gap-4 text-yellow-500 mb-3 uppercase text-[9px] font-black tracking-widest">
          <span className="animate-pulse text-lg">⚠</span> MEMECOIN_RISK_WARNING
        </div>
        <p className="text-zinc-300 text-[10px] leading-relaxed uppercase tracking-tight">
          ATTENTION: Memecoin trading involves extreme volatility and substantial risk.
          Only trade with funds you can afford to lose. Always start with DRY RUN mode enabled.
        </p>
      </div>

      {/* 2. System Status Toggles */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.5em] italic">// System_Status_Array</h3>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MasterToggle
            label="Autonomous_Core"
            desc="Enable AI trading decisions"
            active={cfg.enabled}
            onToggle={() => update("enabled", !cfg.enabled)}
            icon="◈"
          />
          <MasterToggle
            label="Simulation_Mode"
            desc="Paper trading (no real BNB spent)"
            active={cfg.dryRun}
            onToggle={() => update("dryRun", !cfg.dryRun)}
            icon="◈"
            activeColor="#f59e0b"
          />
        </div>
      </section>

      {/* 3. Scan Mode Selection */}
      <section className="space-y-6">
        <div className="flex justify-between items-end border-b border-zinc-800 pb-6">
          <div>
            <h3 className="text-zinc-400 text-[10px] font-mono uppercase tracking-[0.5em] italic">// Token_Discovery_Mode</h3>
            <p className="text-zinc-600 text-[9px] uppercase mt-1 tracking-widest">How to find trading opportunities</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SCAN_MODES.map(opt => (
            <button
              key={opt.v}
              onClick={() => update("scanMode", opt.v)}
              className={`cursor-pointer p-6 border text-left transition-all ${
                cfg.scanMode === opt.v
                  ? "border-[#F3BA2F] bg-[#F3BA2F11] shadow-[0_0_20px_rgba(243,186,47,0.15)]"
                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
              }`}
            >
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                cfg.scanMode === opt.v ? "text-[#F3BA2F]" : "text-zinc-400"
              }`}>
                {opt.l}
              </span>
              <p className="text-zinc-600 text-[8px] uppercase mt-2 tracking-widest">{opt.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Interval & Risk Strategy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Loop Interval */}
        <div className="space-y-6">
          <div>
            <h4 className="text-[9px] text-zinc-500 uppercase tracking-[0.5em] font-mono italic mb-4">// Loop_Interval_Protocol</h4>
            <p className="text-zinc-600 text-[9px] uppercase tracking-widest">How often to analyze tokens</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { v: 60, l: "1 MIN" },
              { v: 300, l: "5 MIN" },
              { v: 900, l: "15 MIN" },
              { v: 3600, l: "1 HOUR" },
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => update("loopIntervalSeconds", opt.v)}
                className={`cursor-pointer py-4 text-[9px] font-black border transition-all ${
                  cfg.loopIntervalSeconds === opt.v
                    ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-600 bg-zinc-950"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        {/* Risk Profile */}
        <div className="space-y-6">
          <div>
            <h4 className="text-[9px] text-zinc-500 uppercase tracking-[0.5em] font-mono italic mb-4">// Risk_Profile_Selector</h4>
            <p className="text-zinc-600 text-[9px] uppercase tracking-widest">Pre-set trading parameters</p>
          </div>
          <div className="space-y-3">
            {Object.entries(RISK_PROFILES).map(([key, data]) => (
              <button
                key={key}
                onClick={() => {
                  update("riskLevel", key);
                  update("stopLossPct", parseFloat(data.sl));
                  update("takeProfitPct", parseFloat(data.tp));
                  update("minConfidence", parseFloat(data.conf) / 100);
                  update("minLiquidityUsd", data.liq === "$3K" ? 3000 : data.liq === "$5K" ? 5000 : 10000);
                  update("maxRugRisk", parseInt(data.rug));
                }}
                className={`cursor-pointer w-full p-4 border text-left transition-all flex justify-between items-center ${
                  cfg.riskLevel === key
                    ? "border-[#F3BA2F] bg-[#F3BA2F11]"
                    : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                }`}
              >
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    cfg.riskLevel === key ? "text-[#F3BA2F]" : "text-zinc-400"
                  }`}>
                    {key}
                  </span>
                  <p className="text-zinc-600 text-[8px] uppercase mt-1 tracking-widest">{data.desc}</p>
                </div>
                <div className="text-right text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                  <div>SL: {data.sl}</div>
                  <div>TP: {data.tp}</div>
                  <div>Conf: {data.conf}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Execution & Exit Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 border-y border-zinc-800 py-20 bg-zinc-900/5">
        <div className="space-y-16 p-8">
          <div>
            <h4 className="text-[9px] text-zinc-400 uppercase tracking-[0.5em] font-mono italic mb-2">Exposure_Thresholds</h4>
            <p className="text-zinc-600 text-[8px] uppercase tracking-widest">Position sizing limits</p>
          </div>
          <ArchitectSlider
            label="Max_Position_BNB"
            value={`${cfg.maxPositionBnb.toFixed(3)} BNB`}
            min={0.01} max={1} step={0.01}
            v={cfg.maxPositionBnb}
            onChange={val => update("maxPositionBnb", val)}
          />
          <ArchitectSlider
            label="Intelligence_Confidence"
            value={`${Math.round(cfg.minConfidence * 100)}%`}
            min={30} max={90} step={5}
            v={cfg.minConfidence * 100}
            onChange={val => update("minConfidence", val / 100)}
          />
          <ArchitectSlider
            label="Max_Open_Positions"
            value={`${cfg.maxOpenPositions}`}
            min={1} max={10} step={1}
            v={cfg.maxOpenPositions}
            onChange={val => update("maxOpenPositions", val)}
          />
        </div>

        <div className="space-y-16 p-8 border-l border-zinc-800">
          <div>
            <h4 className="text-[9px] text-zinc-400 uppercase tracking-[0.5em] font-mono italic mb-2">Risk_Mitigation</h4>
            <p className="text-zinc-600 text-[8px] uppercase tracking-widest">Auto-exit thresholds</p>
          </div>
          <ArchitectSlider
            label="Stop_Loss_%"
            value={`${cfg.stopLossPct}%`}
            min={1} max={20} step={0.5}
            v={cfg.stopLossPct}
            onChange={val => update("stopLossPct", val)}
          />
          <ArchitectSlider
            label="Take_Profit_%"
            value={`${cfg.takeProfitPct}%`}
            min={5} max={50} step={1}
            v={cfg.takeProfitPct}
            onChange={val => update("takeProfitPct", val)}
          />
        </div>
      </div>

      {/* 6. Filtering Criteria */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.5em] italic">// Opportunity_Filters</h3>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FilterCard
            label="Min_Liquidity_USD"
            value={`$${cfg.minLiquidityUsd.toLocaleString()}`}
            sub="Skip tokens below this liquidity"
          >
            <input
              type="range"
              min={1000}
              max={50000}
              step={1000}
              value={cfg.minLiquidityUsd}
              onChange={e => update("minLiquidityUsd", parseInt(e.target.value))}
              className="w-full accent-[#F3BA2F]"
            />
          </FilterCard>

          <FilterCard
            label="Max_Rug_Risk"
            value={`${cfg.maxRugRisk}/100`}
            sub="0=safe, 100=extreme risk"
          >
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={cfg.maxRugRisk}
              onChange={e => update("maxRugRisk", parseInt(e.target.value))}
              className="w-full accent-[#F3BA2F]"
            />
          </FilterCard>

          <FilterCard
            label="Bonding_Curve_Range"
            value={`${cfg.bcMinPct}% - ${cfg.bcMaxPct}%`}
            sub="Target bonding curve fill %"
          >
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={cfg.bcMinPct}
                onChange={e => update("bcMinPct", parseInt(e.target.value))}
                className="flex-1 accent-[#F3BA2F]"
              />
              <span className="text-[8px] font-mono text-zinc-500">to</span>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={cfg.bcMaxPct}
                onChange={e => update("bcMaxPct", parseInt(e.target.value))}
                className="flex-1 accent-[#F3BA2F]"
              />
            </div>
          </FilterCard>
        </div>
      </div>

      {/* 7. Watchlist Display */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.5em] italic">// Watchlist_Tokens</h3>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>

        {(!cfg.watchlist || cfg.watchlist.length === 0) ? (
          <div className="text-zinc-600 text-[10px] uppercase tracking-widest text-center py-8 border border-zinc-800">
            No tokens in watchlist — add tokens from Portfolio tab
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {cfg.watchlist.map((addr) => (
              <WatchlistTokenCard key={addr} address={addr} onRemove={(removedAddr) => {
                update("watchlist", cfg.watchlist.filter(a => a !== removedAddr));
              }} />
            ))}
          </div>
        )}
      </section>

      {/* 8. Deployment Button */}
      <motion.button
        onClick={save}
        disabled={saving}
        whileHover={{ scale: saving ? 1 : 1.01 }}
        whileTap={{ scale: saving ? 1 : 0.99 }}
        className={`cursor-pointer w-full py-8 font-black uppercase tracking-[1em] text-[10px] transition-all border active:scale-[0.98] relative overflow-hidden ${
          saved
            ? "bg-green-500 text-black border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.4)]"
            : "bg-white text-black border-white hover:bg-[#F3BA2F] hover:border-[#F3BA2F] hover:shadow-[0_0_30px_rgba(243,186,47,0.4)]"
        }`}
      >
        {saving && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
        {saving ? "SYNCING_PROTOCOL..." : saved ? "✓ CONFIG_DEPLOYED" : "COMMIT_SYSTEM_CHANGES"}
      </motion.button>
    </motion.div>
  );
}

function WatchlistTokenCard({ address, onRemove }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch(`https://four.meme/meme-api/v1/private/token/get/v2?address=${address}`);
        const data = await res.json();
        setToken(data.data || null);
      } catch (e) {
        console.log("[WatchlistCard] Fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchToken();
  }, [address]);

  if (loading) {
    return (
      <div className="border border-zinc-800 bg-zinc-950 p-3 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-16 mb-2" />
        <div className="h-3 bg-zinc-800 rounded w-24" />
      </div>
    );
  }

  const symbol = token?.symbol || address.slice(0, 8);
  const name = token?.name || "Unknown";
  const price = token?.price ? parseFloat(token.price) : 0;
  const img = token?.img;

  return (
    <div className="border border-zinc-800 bg-zinc-950 p-3 hover:border-[#F3BA2F] transition-colors group relative">
      <button
        onClick={() => onRemove(address)}
        className="absolute top-2 right-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove from watchlist"
      >
        ✕
      </button>
      <a
        href={`https://four.meme/token/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="flex items-center gap-2 mb-2">
          {img ? (
            <img
              src={`https://four.meme${img}`}
              alt={symbol}
              className="w-6 h-6 rounded-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className={`w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-black text-[#F3BA2F] ${img ? 'hidden' : ''}`}>
            {symbol.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-white font-bold text-xs">{symbol}</span>
        </div>
        <div className="text-[#F3BA2F] font-mono text-xs">${price.toFixed(8)}</div>
        <div className="text-zinc-600 text-[8px] truncate">{name}</div>
        <div className="text-zinc-700 text-[7px] truncate mt-1">{address.slice(0, 10)}...</div>
      </a>
    </div>
  );
}

function MasterToggle({ label, desc, active, onToggle, icon = "◈", activeColor = "#F3BA2F" }) {
  return (
    <button
      onClick={onToggle}
      className={`cursor-pointer p-6 border flex flex-col gap-6 transition-all group relative overflow-hidden ${
        active
          ? 'bg-zinc-900 border-[#F3BA2F] shadow-[0_0_20px_rgba(243,186,47,0.15)]'
          : 'bg-black border-zinc-900 hover:border-[#F3BA2F]'
      }`}
    >
      <div className={`text-3xl absolute top-4 right-4 transition-opacity ${active ? 'opacity-100' : 'opacity-20'}`} style={{ color: active ? activeColor : '#fff' }}>
        {icon}
      </div>

      <span className={`text-[9px] font-black uppercase tracking-[0.3em] font-mono text-left w-full ${
        active ? 'text-[#F3BA2F]' : 'text-zinc-500 group-hover:text-[#F3BA2F]'
      }`}>
        {label}
      </span>

      <span className="text-[8px] text-zinc-600 uppercase tracking-widest text-left">
        {desc}
      </span>

      <div className={`w-full h-8 border flex items-center px-1 transition-colors relative ${
        active ? 'border-[#F3BA2F] bg-[#F3BA2F11]' : 'border-zinc-800 bg-zinc-950'
      }`}>
        <motion.div
          animate={{ x: active ? '280%' : '0%' }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`w-6 h-6 shadow-lg relative z-10 ${
            active ? 'bg-[#F3BA2F]' : 'bg-zinc-700'
          }`}
        />
      </div>
    </button>
  );
}

function FilterCard({ label, value, sub, children }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-6 space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-[9px] text-zinc-400 uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-black text-[#F3BA2F] font-mono">{value}</span>
      </div>
      {children}
      <p className="text-[7px] text-zinc-600 uppercase tracking-widest">{sub}</p>
    </div>
  );
}

function ArchitectSlider({ label, value, min, max, step, v, onChange }) {
  const percentage = ((v - min) / (max - min)) * 100;

  return (
    <div className="space-y-4">
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.25em] items-center">
        <span className="text-zinc-400">{label}</span>
        <span className="text-white font-black italic px-3 py-1 bg-zinc-900 border border-zinc-800" style={{ borderBottomColor: '#F3BA2F' }}>
          {value}
        </span>
      </div>
      <div className="relative h-2">
        <div className="absolute inset-0 bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#F3BA2F] to-[#F3BA2F88]"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={v}
          onChange={e => onChange(+e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-crosshair"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#F3BA2F] rounded-full shadow-[0_0_10px_#F3BA2F] pointer-events-none transition-all"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between text-[8px] font-mono text-zinc-700 uppercase tracking-widest">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
