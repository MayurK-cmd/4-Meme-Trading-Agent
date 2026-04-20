import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AgentStatusBar from "../components/AgentStatusBar";
import ConfigTab from "../tabs/ConfigTab";
import DecisionsTab from "../tabs/DecisionsTab";
import LogsTab from "../tabs/LogsTab";
import PortfolioTab from "../tabs/PortfolioTab";

const TABS = ["portfolio", "config", "decisions", "logs"];
const BSC_GOLD = "#F0B90B"; // BNB Chain official gold

// Sample memecoin data for ticker - v2 (4.meme style tokens)
const MEMECOIN_TICKERS = [
  { symbol: "PEPE", price: 0.00000721, change: "5.23" },
  { symbol: "WIF", price: 2.34, change: "-2.15" },
  { symbol: "BONK", price: 0.00002156, change: "3.45" },
  { symbol: "FLOKI", price: 0.0001523, change: "-1.20" },
  { symbol: "BRETT", price: 0.089, change: "8.50" },
  { symbol: "POPCAT", price: 0.42, change: "12.30" },
  { symbol: "MEW", price: 0.00523, change: "-5.30" },
  { symbol: "BOME", price: 0.0089, change: "2.95" },
  { symbol: "SLERF", price: 0.234, change: "-8.10" },
  { symbol: "MYRO", price: 0.089, change: "4.50" },
  { symbol: "WOJAK", price: 0.00012, change: "1.20" },
  { symbol: "BABYDOGE", price: 0.0000000023, change: "-0.85" },
];

export default function Dashboard({ user, onLogout }) {
  const [tab, setTab] = useState("portfolio");
  const [showProtocol, setShowProtocol] = useState(false);
  const [systemTime, setSystemTime] = useState(new Date().toLocaleTimeString());
  const [tickerData, setTickerData] = useState(MEMECOIN_TICKERS);

  useEffect(() => {
    const timer = setInterval(() => setSystemTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch 4.meme trending tokens for ticker (fallback to static data)
  useEffect(() => {
    const fetchTrendingTokens = async () => {
      try {
        const response = await fetch("https://four.meme/meme-api/v1/private/token/trending?limit=20");
        const raw = await response.json();
        const tokens = (raw?.data?.tokens || [])
          .filter(t => t.symbol && t.lastPrice)
          .map(t => ({
            symbol: t.symbol,
            price: parseFloat(t.lastPrice) / 1e18,  // Convert from wei
            change: (Math.random() * 10 - 3).toFixed(2),  // Simulated change
          }))
          .slice(0, 30);

        if (tokens.length > 0) {
          setTickerData(tokens);
        }
      } catch (e) {
        // Use static fallback data
        console.log("[Dashboard] Using fallback memecoin ticker data");
      }
    };

    fetchTrendingTokens();
  }, []);

  const renderTab = () => {
    switch (tab) {
      case "portfolio":
        return <PortfolioTab />;
      case "config":
        return <ConfigTab />;
      case "decisions":
        return <DecisionsTab />;
      case "logs":
        return <LogsTab />;
      default:
        return <ConfigTab />;
    }
  };

  return (
    <div className="min-h-screen bg-[#020408] text-zinc-300 font-mono">
      {/* Top Navigation Bar */}
      <nav className="border-b border-zinc-900 bg-black/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <motion.div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F3BA2F] to-[#F3BA2F44] flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <span className="text-black font-black text-xs">4M</span>
              </motion.div>
              <span className="text-white font-black uppercase tracking-[0.3em] text-sm">
                4MemePilot
              </span>
            </div>

            {/* Tab Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-6 py-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer ${
                    tab === t
                      ? "text-[#F3BA2F] border-b-2 border-[#F3BA2F]"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-[8px] text-zinc-500 uppercase tracking-widest">System Time</div>
                <div className="text-[10px] text-white font-mono">{systemTime}</div>
              </div>
              <button
                onClick={onLogout}
                className="text-[8px] uppercase tracking-widest text-zinc-500 hover:text-red-500 transition-colors cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>

        {/* Ticker Tape */}
        <div className="overflow-hidden border-t border-zinc-900 bg-zinc-950/50">
          <motion.div
            className="flex gap-12 py-2 whitespace-nowrap"
            animate={{ x: tickerData.length > 0 ? [0, -500] : 0 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          >
            {[...tickerData, ...tickerData].map((token, i) => (
              <div key={`${token.symbol}-${i}`} className="flex items-center gap-2 text-[8px]">
                <span className="font-black text-zinc-400">{token.symbol}</span>
                <span className="text-zinc-500">${token.price}</span>
                <span className={parseFloat(token.change) >= 0 ? "text-green-500" : "text-red-500"}>
                  {parseFloat(token.change) >= 0 ? "+" : ""}{token.change}%
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-white text-xl font-black uppercase tracking-[0.3em]">
              {tab.toUpperCase()}
            </h1>
            <div className="h-px flex-1 bg-zinc-900" />
          </div>
          <p className="text-zinc-600 text-[9px] uppercase tracking-widest">
            {tab === "portfolio" && "View your trading performance and open positions"}
            {tab === "config" && "Configure AI trading parameters and risk management"}
            {tab === "decisions" && "Review AI trading decisions with on-chain verification"}
            {tab === "logs" && "Real-time agent activity stream"}
          </p>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Status Bar */}
      <AgentStatusBar />

      {/* Footer */}
      <footer className="border-t border-zinc-900 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[8px] text-zinc-700 uppercase tracking-widest">
            4MemePilot — AI-Powered Memecoin Trading on four.meme
          </p>
          <p className="text-[7px] text-zinc-800 mt-2 uppercase tracking-wider">
            Built for the DoraHacks 4-meme AI Sprint 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
