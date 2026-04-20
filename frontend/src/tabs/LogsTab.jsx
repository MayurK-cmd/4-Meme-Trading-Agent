import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const BNB_GOLD = "#F0B90B"; // BNB Chain official gold

export default function LogsTab() {
  const [logs, setLogs] = useState([]);
  const logRef = useRef(null);
  const autoScrollRef = useRef(true);
  const [filterText, setFilterText] = useState("");
  const [showWarning, setShowWarning] = useState(true); // Default to true to show on mount

  useEffect(() => {
    fetch(`${API}/api/logs?limit=500`)
      .then(r => r.json())
      .then(entries => setLogs(entries.map(e => ({ line: e.line, ts: e.timestamp }))))
      .catch(() => {});

    const es = new EventSource(`${API}/api/logs/stream`);
    es.onmessage = (e) => {
      try {
        const { line, timestamp } = JSON.parse(e.data);
        setLogs(prev => {
          const next = [...prev, { line, ts: timestamp }];
          return next.length > 1000 ? next.slice(-500) : next;
        });
      } catch (err) {
        console.error("Log Stream Error:", err);
      }
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    if (autoScrollRef.current && logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const highlightLine = (text) => {
    if (!text) return null;
    let highlighted = text;
    highlighted = highlighted.replace(/\[([A-Z0-9]+)\]/g, `<span style="color: ${BNB_GOLD}; font-weight: 900;">[$1]</span>`);
    highlighted = highlighted.replace(/\bBUY\b/g, `<span style="color: #22c55e; font-weight: 900;">▲ BUY</span>`);
    highlighted = highlighted.replace(/\bSELL\b/g, `<span style="color: #ef4444; font-weight: 900;">▼ SELL</span>`);
    highlighted = highlighted.replace(/\bHOLD\b/g, `<span style="color: #6b7280; font-weight: 900;">─ HOLD</span>`);
    highlighted = highlighted.replace(/(\$[\d,]+\.?\d*)/g, `<span style="color: #ffffff; font-weight: 700;">$1</span>`);
    highlighted = highlighted.replace(/([+-]?\d+\.?\d*%)/g, `<span style="color: #fbbf24; font-weight: 600;">$1</span>`);
    highlighted = highlighted.replace(/(conf \d+%)/gi, `<span style="color: ${BNB_GOLD}; font-style: italic; font-weight: 700;">$1</span>`);
    highlighted = highlighted.replace(/(Bonding: ?\d+\.?\d*%)/gi, `<span style="color: #fbbf24; font-weight: 600;">$1</span>`);
    highlighted = highlighted.replace(/(Liq: ?\$[\d,]+\.?\d*)/gi, `<span style="color: #22c55e; font-weight: 600;">$1</span>`);
    highlighted = highlighted.replace(/(ERROR|FAILED|Error|failed)/g, `<span style="color: #ef4444; font-weight: 900; background: rgba(239,68,68,0.1); padding: 0 4px;">$1</span>`);
    highlighted = highlighted.replace(/(SUCCESS|OK|completed|Success)/g, `<span style="color: #22c55e; font-weight: 700;">$1</span>`);

    return <div dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  const filteredLogs = filterText
    ? logs.filter(log => log.line.toLowerCase().includes(filterText.toLowerCase()))
    : logs;

  return (
    <div className="relative space-y-4 h-[calc(100vh-250px)] flex flex-col">
      {/* Self-Hosting Modal */}
      <AnimatePresence>
        {showWarning && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full bg-zinc-950 border border-zinc-800 p-6 shadow-[0_0_50px_rgba(0,0,0,1)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#F0B90B] to-transparent" />
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-red-500 text-xl">⚠</span>
                  <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#F0B90B]">System Connectivity Notice</h2>
                </div>
                
                <p className="text-[10px] leading-relaxed font-mono text-zinc-400 uppercase tracking-widest">
                  To see the agent in action, the agent should be running <span className="text-white">locally</span> or you must <span className="text-white">self-host</span>. 
                  Since a wallet private key is involved, we do not store sensitive credentials on our servers for your security.
                </p>

                <button
                  onClick={() => setShowWarning(false)}
                  className="mt-2 w-full py-2 bg-[#F0B90B11] border border-[#F0B90B33] text-[#F0B90B] text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#F0B90B22] transition-all cursor-pointer"
                >
                  Acknowledge & Continue
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Terminal Header */}
      <div className="flex justify-between items-center pb-4 border-b border-zinc-900">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F0B90B11] border border-[#F0B90B33] rounded-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
            <span className="text-[9px] text-[#F0B90B] font-black uppercase tracking-[0.2em]">LIVE_STREAM</span>
          </div>
          <span 
            className="cursor-help text-zinc-600 hover:text-[#F0B90B] transition-colors" 
            onClick={() => setShowWarning(true)}
          >
            ⓘ
          </span>
          <span className="text-zinc-600 font-mono text-[10px] uppercase tracking-widest">
            Buffer: <span className="text-zinc-400">{filteredLogs.length}</span> / {logs.length}
          </span>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="FILTER_LOGS..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="bg-zinc-950 border border-zinc-900 px-4 py-1.5 text-[9px] font-mono text-white placeholder-zinc-700 focus:border-[#F0B90B] outline-none uppercase tracking-widest w-48 cursor-text"
          />
          <button
            onClick={() => { autoScrollRef.current = true; if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }}
            className="cursor-pointer px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-[#F0B90B] border border-zinc-900 hover:border-[#F0B90B] transition-all bg-zinc-950"
          >
            Bottom
          </button>
          <button
            onClick={() => setLogs([])}
            className="cursor-pointer px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-red-900 hover:text-red-500 border border-red-900/30 hover:border-red-500/50 transition-all bg-zinc-950"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div
        ref={logRef}
        onScroll={() => {
          if (!logRef.current) return;
          const { scrollTop, scrollHeight, clientHeight } = logRef.current;
          autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
        }}
        className="flex-1 overflow-y-auto font-mono text-[10px] bg-black border border-zinc-900 shadow-2xl custom-scrollbar"
        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.6" }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-[10px] text-[#F0B90B] uppercase tracking-[0.5em] font-black"
            >
              {filterText ? "NO_MATCHING_LOGS" : "WAITING_FOR_DATA"}
            </motion.div>
          </div>
        ) : (
          <div className="p-4">
            {filteredLogs.map((log, i) => (
              <div key={i} className="flex gap-4 group hover:bg-[#F0B90B03] py-0.5 px-2 -mx-2 rounded-sm">
                <span className="text-zinc-800 select-none font-mono text-[9px] pt-0.5 w-12 flex-shrink-0 text-right">
                  {(i + 1).toString().padStart(5, '0')}
                </span>
                <span className="text-zinc-700 select-none font-mono text-[8px] pt-0.5 w-20 flex-shrink-0">
                  {log.ts ? new Date(log.ts).toLocaleTimeString('en-US', { hour12: false }) : '--:--:--'}
                </span>
                <div className="text-zinc-400 flex-1 group-hover:text-zinc-200 transition-colors border-l border-zinc-900/50 pl-4 group-hover:border-[#F0B90B]/50">
                  {highlightLine(log.line)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Terminal Status Footer */}
      <div className="flex justify-between items-center text-[8px] font-mono text-zinc-700 uppercase tracking-widest pt-2 border-t border-zinc-900">
        <div className="flex gap-6">
          <span>Encoding: UTF-8</span>
          <span>Source: 4Meme_Agent_Python</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_6px_#22c55e]" />
            Stream: Active
          </span>
          <span className="text-zinc-600">
            Auto-scroll: {autoScrollRef.current ? "ON" : "OFF"}
          </span>
        </div>
      </div>
    </div>
  );
}