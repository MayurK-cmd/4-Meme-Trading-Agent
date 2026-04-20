import { useState, useEffect } from "react";
import { useApi } from "../useApi";
import { motion } from "framer-motion";

const BSC_GOLD = "#F0B90B"; // BNB Chain official gold

// 4.meme API for token search
const FOUR_MEME_BASE_URL = "https://four.meme/meme-api/v1";

export default function PortfolioTab() {
  const api = useApi();
  const [portfolio, setPortfolio] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [watchlistDetails, setWatchlistDetails] = useState([]);

  // Fetch portfolio and config on mount
  useEffect(() => {
    api.get("/api/portfolio").then(setPortfolio).catch(() => {});
    api.get("/api/config").then(cfg => {
      if (cfg?.watchlist) {
        setWatchlist(cfg.watchlist);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search tokens on 4.meme
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Check if search query is a contract address (0x...)
        const isContractAddress = /^0x[a-fA-F0-9]{40}$/.test(searchQuery.trim());

        let tokens = [];

        if (isContractAddress) {
          // Direct fetch by address
          try {
            const res = await fetch(`${FOUR_MEME_BASE_URL}/private/token/get/v2?address=${searchQuery.trim()}`);
            const data = await res.json();
            if (data.data && data.data.address) {
              tokens = [{
                ...data.data,
                address: data.data.address,
                symbol: data.data.symbol || "UNKNOWN",
                name: data.data.name || "Unknown",
                lastPrice: data.data.price || 0,
                liquidity: data.data.trading ? parseFloat(data.data.trading) * 600 : 0,
              }];
            }
          } catch (e) {
            console.log("[Search] Direct address fetch error:", e);
          }
        } else {
          // Search by keyword
          const res = await fetch(`${FOUR_MEME_BASE_URL}/public/token/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              keyword: searchQuery,
              orderBy: "Hot",
              pageIndex: 1,
              pageSize: 20,
              listedPancake: false,
            }),
          });
          const data = await res.json();
          console.log("[Search] Raw response:", data);
          // Map API response to consistent format
          const apiList = data.data?.list || data.data || [];
          tokens = apiList
            .map(t => ({
              ...t,
              address: t.tokenAddress || t.address,
              symbol: t.symbol || t.shortName || "UNKNOWN",
              name: t.name || "Unknown",
              lastPrice: t.price || t.lastPrice || 0,
              liquidity: t.volume || t.liquidity || 0,
              img: t.img,
            }))
            .filter(t =>
              t.symbol?.toUpperCase().includes(searchQuery.toUpperCase()) ||
              t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              t.address?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        console.log("[Search] Filtered tokens:", tokens);
        setSearchResults(tokens.slice(0, 10));
      } catch (e) {
        console.log("[Search] Error:", e);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 100); // Reduced debounce for CA search

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Add token to watchlist
  const addToWatchlist = async (token) => {
    try {
      const currentCfg = await api.get("/api/config");
      const newWatchlist = [...(currentCfg.watchlist || [])];
      if (!newWatchlist.includes(token.address)) {
        newWatchlist.push(token.address);
        await api.post("/api/config", { watchlist: newWatchlist.slice(0, 20) });
        setWatchlist(newWatchlist);
        setSearchQuery("");
        setSearchResults([]);
      }
    } catch (e) {
      console.error("[Watchlist] Add error:", e);
    }
  };

  // Remove token from watchlist
  const removeFromWatchlist = async (address) => {
    try {
      const newWatchlist = watchlist.filter(a => a !== address);
      await api.post("/api/config", { watchlist: newWatchlist });
      setWatchlist(newWatchlist);
    } catch (e) {
      console.error("[Watchlist] Remove error:", e);
    }
  };

  // Fetch watchlist token details
  useEffect(() => {
    if (watchlist.length === 0) {
      setWatchlistDetails([]);
      return;
    }

    const fetchWatchlistDetails = async () => {
      try {
        const details = await Promise.all(
          watchlist.map(async (addr) => {
            try {
              const res = await fetch(`${FOUR_MEME_BASE_URL}/private/token/get/v2?address=${addr}`);
              const data = await res.json();
              return data.data || { address: addr, symbol: "UNKNOWN", error: true };
            } catch {
              return { address: addr, symbol: "UNKNOWN", error: true };
            }
          })
        );
        setWatchlistDetails(details);
      } catch (e) {
        console.log("[Watchlist] Fetch error:", e);
      }
    };

    fetchWatchlistDetails();
  }, [watchlist]);

  if (!portfolio) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-2 border-[#1a2b3b] border-t-[#F3BA2F] rounded-full"
        />
        <div className="font-mono text-zinc-500 animate-pulse uppercase tracking-[0.3em] text-xs">
          Loading_Portfolio_Data...
        </div>
      </div>
    );
  }

  const totalRealizedPnl = portfolio.totalRealizedPnl || 0;
  const totalTrades = portfolio.totalTrades || 0;
  const winRate = portfolio.winRate || 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl space-y-12 pb-32">

      {/* Trading Stats */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          label="Realized_PnL"
          value={`${totalRealizedPnl >= 0 ? "+" : ""}$${totalRealizedPnl.toFixed(2)}`}
          valueColor={totalRealizedPnl >= 0 ? "#22c55e" : "#ef4444"}
        />
        <StatCard label="Total_Trades" value={totalTrades} />
        <StatCard label="Win_Rate" value={`${winRate.toFixed(1)}%`} />
        <StatCard label="Wallet" value={`${portfolio.bscAddress?.slice(0, 6) || "N/A"}...`} />
      </section>

      {/* Token Search */}
      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.5em] italic">
            // Add_Tokens_To_Watchlist
          </h3>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search by token name, symbol, or address (e.g., PEPE, 0x...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 p-4 text-sm text-white placeholder-zinc-600 focus:border-[#F3BA2F] focus:outline-none transition-colors"
          />

          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden z-50 max-h-96 overflow-y-auto">
              {searchResults.map((token) => (
                <div
                  key={token.address}
                  className="flex items-center justify-between p-4 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800 last:border-b-0"
                  onClick={() => addToWatchlist(token)}
                >
                  <div className="flex items-center gap-3">
                    {token.img ? (
                      <img
                        src={`https://four.meme${token.img}`}
                        alt={token.symbol}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-[#F3BA2F] ${token.img ? 'hidden' : ''}`}>
                      {token.symbol?.slice(0, 3) || "?"}
                    </div>
                    <div>
                      <div className="text-white text-sm font-bold">{token.symbol || "UNKNOWN"}</div>
                      <div className="text-zinc-500 text-[10px]">{token.name || "Unknown"}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[#F3BA2F] text-xs font-mono">
                      ${parseFloat(token.lastPrice || 0).toFixed(8)}
                    </div>
                    <div className="text-zinc-600 text-[9px]">
                      Liq: ${(parseFloat(token.liquidity) || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isSearching && (
            <div className="absolute top-full left-0 right-0 mt-2 text-center text-zinc-500 text-[10px] uppercase tracking-widest animate-pulse">
              Searching_4.meme...
            </div>
          )}
        </div>
      </section>

      {/* Watchlist */}
      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.5em] italic">
            // Current_Watchlist
          </h3>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>

        {watchlist.length === 0 ? (
          <div className="text-zinc-600 text-[10px] uppercase tracking-widest text-center py-12 border border-zinc-800">
            No tokens in watchlist — search above to add
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlist.map((addr) => {
              const details = watchlistDetails.find(d => d.address === addr);
              const symbol = details?.symbol || addr.slice(0, 8);
              const name = details?.name || "Unknown";
              const price = details?.lastPrice ? parseFloat(details.lastPrice) : 0;
              const hasError = details?.error;

              return (
                <div
                  key={addr}
                  className="border border-zinc-800 bg-zinc-950 p-4 hover:border-[#F3BA2F] transition-colors group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black text-[#F3BA2F]">
                        {symbol.slice(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">{symbol}</div>
                        <div className="text-zinc-600 text-[9px] uppercase">{name}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromWatchlist(addr)}
                      className="text-zinc-600 hover:text-red-500 transition-colors"
                      title="Remove from watchlist"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-600">Price:</span>
                      <span className="text-[#F3BA2F] font-mono">${price.toFixed(8)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-600">Address:</span>
                      <a
                        href={`https://bscscan.com/address/${addr}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-500 hover:text-[#F3BA2F] truncate max-w-[120px]"
                      >
                        {addr.slice(0, 8)}...
                      </a>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <a
                      href={`https://four.meme/token/${addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-2 text-[9px] uppercase tracking-widest border border-zinc-800 hover:border-[#F3BA2F] hover:text-[#F3BA2F] transition-colors"
                    >
                      View_on_4.meme
                    </a>
                    <a
                      href={`https://bscscan.com/address/${addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-2 text-[9px] uppercase tracking-widest border border-zinc-800 hover:border-[#F3BA2F] hover:text-[#F3BA2F] transition-colors"
                    >
                      BSCScan
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Trades */}
      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.5em] italic">
            // Recent_Trades
          </h3>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>

        <div className="border border-zinc-800 bg-zinc-950 overflow-hidden">
          <table className="w-full text-[9px] uppercase tracking-widest">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="p-4 text-left">Token</th>
                <th className="p-4 text-left">Action</th>
                <th className="p-4 text-right">Price</th>
                <th className="p-4 text-right">PnL</th>
                <th className="p-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {(portfolio.recentDecisions || []).slice(0, 10).map((trade, i) => (
                <tr key={i} className="border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/50">
                  <td className="p-4">
                    <span className="text-white font-bold">{trade.symbol || "UNKNOWN"}</span>
                  </td>
                  <td className="p-4">
                    <span className={trade.action === "BUY" ? "text-green-500" : "text-red-500"}>
                      {trade.action}
                    </span>
                  </td>
                  <td className="p-4 text-right text-zinc-400">
                    ${parseFloat(trade.price_usd || 0).toFixed(6)}
                  </td>
                  <td className="p-4 text-right">
                    {trade.pnl_usdc !== undefined ? (
                      <span className={trade.pnl_usdc >= 0 ? "text-green-500" : "text-red-500"}>
                        {trade.pnl_usdc >= 0 ? "+" : ""}${trade.pnl_usdc.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-zinc-600">-</span>
                    )}
                  </td>
                  <td className="p-4 text-right text-zinc-600">
                    {new Date(trade.timestamp).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(portfolio.recentDecisions || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-600">
                    No trades yet — start trading to see history
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </motion.div>
  );
}

function StatCard({ label, value, valueColor = "#F3BA2F" }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-6">
      <div className="text-zinc-600 text-[9px] uppercase tracking-widest mb-2">{label}</div>
      <div className="text-2xl font-black text-white font-mono" style={{ color: valueColor }}>
        {value}
      </div>
    </div>
  );
}
