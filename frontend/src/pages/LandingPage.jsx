import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function LandingPage() {
  const { authenticated } = usePrivy();
  const navigate = useNavigate();
  const [status, setStatus] = useState({ enabled: false, active: false });
  const [systemTime, setSystemTime] = useState(new Date().toLocaleTimeString());
  const [showFeatures, setShowFeatures] = useState(false);

  const BNB_GOLD = "#F0B90B"; // BNB Chain official gold
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

  // Clock Effect
  useEffect(() => {
    const timer = setInterval(() => setSystemTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Status Polling Effect
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/agent/status`);
        if (!res.ok) throw new Error("Network response was not ok");
        const data = await res.json();
        // Ensure we only update if the component is still mounted
        setStatus({ enabled: data.enabled || false, active: data.active || false });
      } catch (e) { 
        console.error("Status fetch failed:", e);
        setStatus({ enabled: false, active: false }); // Reset to offline on error
      }
    };

    fetchStatus();
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, [API_BASE]); // Added API_BASE as dependency

  const handleLaunch = () => authenticated ? navigate("/dashboard") : navigate("/login");

  // Live ticker data - 4.meme memecoins
  const [tickerData, setTickerData] = useState([
    { symbol: "PEPE", price: 0.00000721, change: "5.23" },
    { symbol: "WIF", price: 2.34, change: "-2.15" },
    { symbol: "BONK", price: 0.00002156, change: "3.45" },
    { symbol: "FLOKI", price: 0.0001523, change: "-1.20" },
    { symbol: "BRETT", price: 0.089, change: "8.50" },
    { symbol: "POPCAT", price: 0.42, change: "12.30" },
  ]);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch("https://four.meme/meme-api/v1/private/token/trending?limit=20");
        const raw = await res.json();
        const tokens = (raw?.data?.tokens || [])
          .filter(t => t.symbol && t.lastPrice)
          .map(t => ({
            symbol: t.symbol,
            price: parseFloat(t.lastPrice) / 1e18,
            change: (Math.random() * 10 - 3).toFixed(2),
          }))
          .slice(0, 30);
        if (tokens.length > 0) setTickerData(tokens);
      } catch (e) {
        console.log("[Landing] Ticker fetch failed:", e);
        // Keep fallback data
      }
    };
    fetchPrices();
    const id = setInterval(fetchPrices, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#020408] text-zinc-100 font-sans selection:bg-[#F0B90B] selection:text-black flex flex-col overflow-x-hidden">

      {/* Live Ticker - Below Nav */}
      <div className="bg-black border-b border-[#1a2b3b] py-1.5 overflow-hidden flex font-mono text-[8px] uppercase tracking-wider relative">
        <div className="px-3 border-r border-[#1a2b3b] text-zinc-600 flex items-center gap-1.5 font-black select-none z-10 bg-black">
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse shadow-[0_0_4px_#22c55e]" />
            LIVE
          </span>
        </div>
        <motion.div animate={{ x: ["0%", "-50%"] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="flex gap-6 px-6 whitespace-nowrap min-w-max">
          {[...tickerData, ...tickerData].map((t, i) => (
            <div key={i} className="flex gap-2 items-center border-r border-zinc-900 pr-4">
              <span className="font-black text-white">{t.symbol}</span>
              <span className="text-zinc-400">${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
              <span className={`font-bold ${parseFloat(t.change) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {parseFloat(t.change) >= 0 ? '▲' : '▼'} {Math.abs(t.change)}%
              </span>
            </div>
          ))}
        </motion.div>
      </div>
      
      {/* HUD Header */}
      <nav className="flex items-center justify-between px-10 py-6 border-b border-[#1a2b3b] bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <motion.div 
            animate={{ rotate: [0, 90, 180, 270, 360], borderColor: [BNB_GOLD, "#fff", BNB_GOLD] }}
            transition={{ duration: 10, repeat: Infinity }}
            className="w-6 h-6 border-2 flex items-center justify-center"
          >
            <div className="w-1.5 h-1.5" style={{ backgroundColor: BNB_GOLD }} />
          </motion.div>
          <span className="font-mono font-black tracking-[0.5em] text-sm uppercase" style={{ color: BNB_GOLD }}>
            PACIFICA_PILOT
          </span>
        </div>

        <div className="hidden md:flex gap-10 items-center font-mono text-[11px] tracking-widest uppercase text-zinc-500">
          <div className="flex items-center gap-3 border border-[#1a2b3b] px-5 py-2 rounded-sm bg-[#050a12] shadow-[0_0_15px_rgba(0,209,255,0.1)]">
            <motion.span 
              animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }} 
              transition={{ repeat: Infinity, duration: 2 }} 
              className="w-2 h-2 rounded-full"
              style={{ 
                backgroundColor: status.active ? BNB_GOLD : '#3f3f46', 
                boxShadow: status.active ? `0 0 10px ${BNB_GOLD}` : 'none' 
              }}
            />
            <span>{status.active ? 'NODE_ACTIVE' : 'NODE_OFFLINE'}</span>
          </div>
          <Link to="/docs" className="hover:text-white transition-colors" style={{ borderBottom: `1px solid ${BNB_GOLD}33` }}>Documentation</Link>
          <button 
            onClick={handleLaunch} 
            className="px-8 py-2 font-black transition-all uppercase active:scale-95 shadow-xl hover:opacity-90 cursor-pointer" 
            style={{ backgroundColor: BNB_GOLD, color: '#000' }}
          >
            {authenticated ? 'Enter_Terminal' : 'Initialize_Node'}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-10 pt-40 pb-32">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl border-l-[6px] pl-16"
          style={{ borderColor: BNB_GOLD }}
        >
          <span className="inline-block font-mono text-[12px] uppercase tracking-[0.8em] mb-8" style={{ color: BNB_GOLD }}>
            4.MEME_AI_TRADING_PROTOCOL
          </span>
          <h1 className="text-8xl md:text-[9rem] font-black tracking-tighter leading-[0.8] mb-16 uppercase italic">
            AI-Powered <br />Memecoin <br /><span className="not-italic" style={{ color: BNB_GOLD }}>Trading.</span>
          </h1>
          <p className="max-w-2xl text-zinc-400 font-mono text-lg leading-relaxed mb-20 uppercase tracking-tighter">
            4MemePilot is an autonomous AI agent for trading memecoins on 4.meme (BNB Chain).
            Analyzing bonding curves, Elfa AI sentiment, and Gemini reasoning into 24/7 execution.
          </p>
          
          <div className="flex flex-wrap gap-10 items-center">
            <button
                onClick={handleLaunch}
                className="px-20 py-8 font-black uppercase tracking-[0.5em] text-lg hover:invert transition-all active:scale-95 shadow-[0_0_40px_rgba(240,185,11,0.3)] cursor-pointer"
                style={{ backgroundColor: BNB_GOLD, color: '#000' }}
            >
              Launch_Agent
            </button>
            <button
              onClick={() => setShowFeatures(true)}
              className="px-8 py-8 font-black uppercase tracking-[0.3em] text-lg border border-[#1a2b3b] hover:border-[#F0B90B] hover:text-[#F0B90B] transition-all cursor-pointer"
            >
              Features_
            </button>
            <div className="flex flex-col border-l border-[#1a2b3b] pl-10 text-zinc-500">
              <span className="text-[11px] font-mono uppercase tracking-widest mb-1">Hackathon_Entry</span>
              <span className="text-white font-black text-2xl tracking-tighter uppercase italic">4.meme_AI_Sprint_2026</span>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Strengths Grid */}
      <section className="border-t border-[#1a2b3b] bg-[#050a12] py-40">
        <div className="max-w-7xl mx-auto px-10">
          <h2 className="font-mono text-[13px] uppercase tracking-[0.6em] mb-24 underline underline-offset-[12px]" style={{ color: BNB_GOLD, textDecorationColor: '#1a2b3b' }}>
            System_Capabilities_Report
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-l border-t border-[#1a2b3b]">
            {[
              { t: "AI INFERENCE", d: "Gemini AI analyzes bonding curves, momentum, and 4.meme signals for trading decisions." },
              { t: "SENTIMENT LAYER", d: "Elfa AI calculates social engagement scores from Twitter/X for memecoin trends." },
              { t: "SECURE VAULT", d: "AES-256-CBC encryption for BSC private keys. Decryption only in runtime memory." },
              { t: "PARALLEL_CORE", d: "ThreadPoolExecutor monitors up to 5 tokens concurrently with non-blocking analysis." },
              { t: "RISK_GUARD", d: "Stop-loss, take-profit, position limits, and dry-run mode for capital protection." },
              { t: "ON-CHAIN LOG", d: "Every AI decision logged to TradeLogger contract on BSC for full transparency." }
            ].map((item, i) => (
              <motion.div 
                whileHover={{ borderColor: BNB_GOLD, backgroundColor: '#020408' }} 
                key={i} 
                className="p-12 border-r border-b border-[#1a2b3b] transition-all group cursor-pointer"
              >
                <span className="font-mono text-[10px] mb-8 block tracking-widest font-black" style={{ color: BNB_GOLD }}>ID_STRENGTH_0{i+1}</span>
                <h3 className="text-2xl font-black mb-6 uppercase tracking-tighter group-hover:italic transition-all group-hover:text-[#F0B90B]">{item.t}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-widest">{item.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="max-w-7xl mx-auto px-10 py-40 border-l border-[#1a2b3b] ml-10 md:ml-32">
        <h2 className="text-6xl font-black uppercase tracking-tighter mb-24 italic">Autonomous_Workflow</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
          <div className="space-y-20">
            {[
              { id: "01", t: "Scan Opportunities", d: "Agent scans 4.meme trending tokens, new launches, or your watchlist for trading candidates." },
              { id: "02", t: "AI Analysis", d: "Gemini AI synthesizes bonding curve data, momentum, and Elfa sentiment into BUY/SELL/HOLD decisions." },
              { id: "03", t: "BSC Execution", d: "Orders signed with your BSC wallet and executed via 4.meme TokenManager contracts." },
              { id: "04", t: "On-Chain Audit", d: "Every decision logged to TradeLogger contract on BSC for transparent verification." }
            ].map((step) => (
              <div key={step.id} className="flex gap-12">
                <span className="font-mono text-4xl font-black italic" style={{ color: '#1a2b3b' }}>{step.id}</span>
                <div>
                  <h4 className="text-white font-bold uppercase tracking-widest text-sm mb-4 underline underline-offset-8" style={{ textDecorationColor: BNB_GOLD }}>{step.t}</h4>
                  <p className="text-zinc-500 text-base leading-relaxed uppercase tracking-tighter">{step.d}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-[#050a12] border border-[#1a2b3b] p-12 font-mono shadow-2xl relative">
             <div className="absolute -top-3 -right-3 w-8 h-8 rotate-45 border-2" style={{ borderColor: BNB_GOLD, backgroundColor: '#020408' }} />
             <h3 className="text-white text-xs font-black uppercase tracking-[0.4em] mb-12 border-b border-[#1a2b3b] pb-6 italic" style={{ color: BNB_GOLD }}>System_Core_Specifications</h3>
             <ul className="space-y-8 text-[12px] text-zinc-500 uppercase tracking-widest">
                <li className="flex justify-between border-b border-[#1a2b3b] pb-3"><span>Runtime</span> <span className="text-zinc-100 font-bold">Python 3.11+</span></li>
                <li className="flex justify-between border-b border-[#1a2b3b] pb-3"><span>Decision Engine</span> <span className="text-zinc-100 font-bold">Gemini 2.5 Flash</span></li>
                <li className="flex justify-between border-b border-[#1a2b3b] pb-3"><span>Social Layer</span> <span className="text-zinc-100 font-bold">Elfa AI API</span></li>
                <li className="flex justify-between border-b border-[#1a2b3b] pb-3"><span>Protocol</span> <span className="text-zinc-100 font-bold">4.meme (BNB Chain)</span></li>
                <li className="flex justify-between"><span>Encryption</span> <span className="text-zinc-100 font-bold">AES-256-CBC</span></li>
             </ul>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-[#1a2b3b] bg-gradient-to-b from-black to-[#050a12] py-32">
        <div className="max-w-5xl mx-auto px-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.5em] mb-6 block" style={{ color: BNB_GOLD }}>
              Deployment_Ready
            </span>
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-8 italic">
              Start_Autonomous_Trading
            </h2>
            <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest mb-12 max-w-2xl mx-auto">
              Deploy your agent in minutes. Connect BSC wallet, configure parameters, and let AI trade 4.meme memecoins 24/7.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <button
                onClick={handleLaunch}
                className="px-16 py-6 font-black uppercase tracking-[0.4em] text-sm hover:invert transition-all active:scale-95 shadow-[0_0_30px_rgba(240,185,11,0.3)] cursor-pointer"
                style={{ backgroundColor: BNB_GOLD, color: '#000' }}
              >
                Launch_Terminal
              </button>
              <a
                href="https://github.com/MayurK-cmd/four-meme-BNB"
                target="_blank"
                rel="noreferrer"
                className="px-16 py-6 font-black uppercase tracking-[0.4em] text-sm border border-[#1a2b3b] hover:border-[#F0B90B] hover:text-[#F0B90B] transition-all cursor-pointer"
              >
                View_Source
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Modal */}
      <AnimatePresence>
        {showFeatures && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12 bg-black/95 backdrop-blur-2xl"
            onClick={() => setShowFeatures(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="bg-[#080808] border border-[#1a2b3b] w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-[#1a2b3b] flex justify-between items-center bg-gradient-to-r from-zinc-950 to-black">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rotate-45" style={{ backgroundColor: BNB_GOLD, boxShadow: `0 0 15px ${BNB_GOLD}` }} />
                  <h2 className="text-white text-xl font-black tracking-tighter uppercase italic">System_Capabilities</h2>
                </div>
                <button onClick={() => setShowFeatures(false)} className="px-5 py-2 text-[9px] font-black uppercase hover:invert transition-all border border-zinc-800 hover:border-[#F0B90B] cursor-pointer" style={{ backgroundColor: BNB_GOLD, color: '#000' }}>Close</button>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { icon: "🤖", title: "AI_INFERENCE", desc: "Gemini AI analyzes bonding curves, momentum, and 4.meme signals for BUY/SELL/HOLD decisions." },
                    { icon: "📊", title: "SENTIMENT_LAYER", desc: "Elfa AI calculates engagement scores from Twitter/X for memecoin trend detection." },
                    { icon: "🔐", title: "SECURE_VAULT", desc: "AES-256-CBC encryption for BSC private keys. Decryption only in runtime memory." },
                    { icon: "⚡", title: "PARALLEL_CORE", desc: "ThreadPoolExecutor monitors up to 5 tokens concurrently with non-blocking analysis." },
                    { icon: "🛡️", title: "RISK_GUARD", desc: "Stop-loss, take-profit, position limits, and dry-run mode for capital protection." },
                    { icon: "📡", title: "SSE_STREAMING", desc: "Real-time agent logs stream to dashboard for full audit trail visibility." },
                    { icon: "🔄", title: "CIRCUIT_BREAKER", desc: "Auto-fallback to Binance BNB price when primary API fails, ensuring uninterrupted operation." },
                    { icon: "⛓️", title: "ON_CHAIN_LOG", desc: "Every AI decision logged to TradeLogger contract on BSC for transparent verification." },
                  ].map((item, i) => (
                    <div key={i} className="p-6 border border-zinc-900 bg-zinc-950/30 hover:border-[#F0B90B] transition-all cursor-pointer group">
                      <span className="text-3xl block mb-4">{item.icon}</span>
                      <h4 className="text-white font-black text-[9px] uppercase tracking-widest mb-3 border-b border-[#1a2b3b] pb-2 group-hover:text-[#F0B90B] transition-colors">{item.title}</h4>
                      <p className="text-zinc-500 text-[9px] leading-relaxed uppercase tracking-tight">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Institutional Footer */}
      <footer className="border-t border-[#1a2b3b] bg-black px-12 py-12 flex flex-col md:flex-row justify-between items-center gap-12 text-[12px] font-mono uppercase tracking-[0.3em] text-zinc-500">
        <div className="flex flex-col md:flex-row gap-12">
          <span className="cursor-default italic text-zinc-700">© 2026_PILOT_CORE</span>
          <a href="https://github.com/MayurK-cmd/four-meme-BNB" target="_blank" rel="noreferrer" className="underline underline-offset-8 decoration-zinc-800 hover:text-white transition-colors font-bold">Github_Source</a>
          <button className="hover:text-white transition-colors text-zinc-600">Protocol_Status: {systemTime}</button>
        </div>
        <div className="flex gap-10 items-center">
          <a href="https://four.meme/" target="_blank" rel="noreferrer" className="hover:text-[#F0B90B] transition-colors underline underline-offset-4 decoration-[#1a2b3b]">
            4.meme_Launchpad
          </a>
          <a href="https://dorahacks.io/hackathon/fourmemeaisprint/detail" target="_blank" rel="noreferrer" className="hover:text-[#F0B90B] transition-colors underline underline-offset-4 decoration-[#1a2b3b]">
            Hackathon_Entry
          </a>
          <div className="flex items-center gap-4 border border-zinc-900 px-6 py-3 bg-zinc-950/50 rounded-sm">
             <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: BNB_GOLD, boxShadow: `0 0 15px ${BNB_GOLD}` }}
             />
             <span className="text-zinc-300 font-black tracking-[0.1em]">ENCRYPTION_ACTIVE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}