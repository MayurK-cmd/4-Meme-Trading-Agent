import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "./useApi";

// Pages
import LandingPage from "./pages/LandingPage";
import DocsPage from "./pages/DocsPage";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const { ready, authenticated, user, logout } = usePrivy();
  const api = useApi();
  const [onboarded, setOnboarded] = useState(null);

  useEffect(() => {
    // Only sync if we have a user and are authenticated
    if (!authenticated || !user) {
      setOnboarded(null);
      return;
    }

    // Skip sync if not ready (Privy token may not be available yet)
    const syncUser = async () => {
      try {
        const data = await api.post("/api/auth/sync", {
          email: user.email?.address || null,
          walletAddress: user.wallet?.address || null
        });
        setOnboarded(data.onboarded);
      } catch (err) {
        console.log("[App] Auth sync skipped - token not ready:", err.message);
        setOnboarded(false);
      }
    };
    syncUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, user]);

  if (!ready) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-mono text-zinc-500 uppercase tracking-widest">
      Initialising_System_Core...
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<DocsPage />} />
        
        {/* Login Route: If already logged in, go to dashboard */}
        <Route 
          path="/login" 
          element={authenticated ? <Navigate to="/dashboard" /> : <LoginPage />} 
        />

        {/* Protected Dashboard Route */}
        <Route 
          path="/dashboard" 
          element={
            !authenticated ? <Navigate to="/login" /> : 
            onboarded === null ? (
              <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-mono text-zinc-500">SYNCING_STATE...</div>
            ) : !onboarded ? (
              <OnboardingPage onDone={() => setOnboarded(true)} />
            ) : (
              <Dashboard user={user} onLogout={logout} />
            )
          } 
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}