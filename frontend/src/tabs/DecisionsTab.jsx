import { useState, useEffect, useMemo } from "react";
import { useApi } from "../useApi";
import { motion } from "framer-motion";

export default function DecisionsTab() {
  const api = useApi();
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("all"); // all, BUY, SELL
  const [timeRange, setTimeRange] = useState("all"); // all, 1h, 24h, 7d
  const BNB_GOLD = "#F0B90B"; // BNB Chain official gold

  useEffect(() => {
    const load = () => {
      api.get("/api/trades?limit=100").then(d => setTrades(d.trades || [])).catch(() => {});
      api.get("/api/trades/stats").then(setStats).catch(() => {});
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [api]);

  // Filter trades based on action and time range
  const filteredTrades = useMemo(() => {
    let result = trades;

    // Filter by action type
    if (filter !== "all") {
      result = result.filter(t => t.action === filter);
    }

    // Filter by time range
    if (timeRange !== "all") {
      const now = Date.now();
      const ranges = {
        "1h": 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
      };
      const cutoff = now - (ranges[timeRange] || 0);
      result = result.filter(t => new Date(t.timestamp).getTime() > cutoff);
    }

    return result;
  }, [trades, filter, timeRange]);

  // Calculate stats for filtered trades
  const filteredStats = useMemo(() => {
    const buys = filteredTrades.filter(t => t.action === "BUY").length;
    const sells = filteredTrades.filter(t => t.action === "SELL").length;
    return { buys, sells, total: filteredTrades.length };
  }, [filteredTrades]);

  return (
    <div className="space-y-12">
      {/* Header with Stats */}
      <div className="flex justify-between items-end border-b border-[#1a2b3b] pb-8">
        <div>
          <h2 className="text-white text-4xl font-black uppercase tracking-tighter italic">Decision_Ledger</h2>
          <div className="flex gap-6 items-center mt-3 font-mono uppercase tracking-[0.15em] text-[10px]">
            <span className="text-zinc-600">Total: <b className="text-white">{filteredStats.total}</b></span>
            <span className="text-green-500">Buy: <b className="text-white">{filteredStats.buys}</b></span>
            <span className="text-red-500">Sell: <b className="text-white">{filteredStats.sells}</b></span>
            {stats && (
              <span className="text-zinc-600">PnL: <b style={{ color: BNB_GOLD }}>${stats.totalPnlUsdc?.toFixed(2) ?? "0.00"}</b></span>
            )}
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex gap-2">
          {["all", "BUY", "SELL"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`cursor-pointer px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all border ${
                filter === f
                  ? f === "BUY" ? "bg-green-500 text-black border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                  : f === "SELL" ? "bg-red-500 text-black border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                  : "bg-[#F0B90B] text-black border-[#F0B90B] shadow-[0_0_15px_rgba(0,209,255,0.3)]"
                  : "border-zinc-900 text-zinc-600 hover:text-zinc-300 hover:border-zinc-700 bg-zinc-950"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Time Range Filter */}
      <div className="flex gap-1 bg-zinc-950/50 p-1 border border-zinc-900 rounded-lg w-fit">
        {[
          { v: "all", l: "ALL_TIME" },
          { v: "1h", l: "LAST_HOUR" },
          { v: "24h", l: "24HOURS" },
          { v: "7d", l: "7DAYS" },
        ].map(opt => (
          <button
            key={opt.v}
            onClick={() => setTimeRange(opt.v)}
            className={`cursor-pointer px-5 py-2 text-[8px] font-black uppercase tracking-widest transition-all rounded-md ${
              timeRange === opt.v
                ? "text-black bg-[#F0B90B] shadow-[0_0_15px_rgba(0,209,255,0.3)]"
                : "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            {opt.l}
          </button>
        ))}
      </div>

      {/* Trade Cards */}
      <div className="grid grid-cols-1 gap-4">
        {filteredTrades.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-20 text-center border border-zinc-900 bg-zinc-950/30"
          >
            <div className="text-zinc-800 text-5xl mb-4">∅</div>
            <div className="font-mono text-zinc-700 uppercase tracking-[0.5em] text-[10px]">
              No_Decisions_Found
            </div>
            <p className="text-zinc-600 text-[9px] uppercase mt-2 tracking-widest">
              {filter !== "all" || timeRange !== "all"
                ? "Adjust filters to see more results"
                : "Waiting_For_Inference_Cycle..."}
            </p>
          </motion.div>
        ) : (
          filteredTrades.map((t, i) => (
            <motion.div
              key={t._id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="p-8 border border-[#1a2b3b] bg-zinc-950/20 hover:border-[#F0B90B] hover:shadow-[0_0_25px_rgba(0,209,255,0.1)] transition-all group cursor-default relative overflow-hidden"
            >
              {/* Action Badge */}
              <div className="absolute top-0 right-0 px-4 py-2 bg-zinc-900/50 border-l border-b border-zinc-900">
                <span className={`text-[8px] font-black tracking-[0.3em] ${
                  t.action === "BUY" ? "text-green-500" : "text-red-500"
                }`}>
                  {t.action}
                </span>
              </div>

              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center font-black text-lg ${
                    t.action === "BUY"
                      ? "border-green-500/30 bg-green-500/10 text-green-500"
                      : "border-red-500/30 bg-red-500/10 text-red-500"
                  }`}>
                    {t.action === "BUY" ? "▲" : "▼"}
                  </div>
                  <div>
                    <span className="text-white font-black text-2xl tracking-widest block">{t.symbol}</span>
                    <span className="text-zinc-600 font-mono text-xs">@ ${t.mark_price?.toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-zinc-500 text-[9px] block font-mono uppercase tracking-widest mb-1">Confidence</span>
                  <span className={`font-black italic text-2xl ${
                    (t.confidence || 0) >= 0.7 ? "text-[#F0B90B]" :
                    (t.confidence || 0) >= 0.5 ? "text-yellow-500" : "text-red-500"
                  }`}>
                    {Math.round((t.confidence || 0) * 100)}%
                  </span>
                </div>
              </div>

              {/* Reasoning */}
              <p className="text-zinc-400 text-sm leading-relaxed border-l-2 border-zinc-900 pl-6 group-hover:border-[#F0B90B] transition-colors pr-20">
                {t.reasoning}
              </p>

              {/* Footer */}
              <div className="flex justify-between items-center mt-6 pt-6 border-t border-zinc-900/50">
                <div className="flex gap-6 text-[9px] font-mono uppercase tracking-widest text-zinc-600">
                  <span>Time: <span className="text-zinc-400">{new Date(t.timestamp).toLocaleString()}</span></span>
                  {t.size_pct && (
                    <span>Size: <span className="text-zinc-400">{Math.round(t.size_pct * 100)}%</span></span>
                  )}
                </div>
                <div className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 border ${
                  t.action === "BUY"
                    ? "border-green-500/30 text-green-500 bg-green-500/5"
                    : "border-red-500/30 text-red-500 bg-red-500/5"
                }`}>
                  {t.action}_ORDER
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
