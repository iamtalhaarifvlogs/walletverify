"use client";

import { useState, useEffect } from "react";
import { Lock, Loader2, LogOut } from "lucide-react";
import WalletTable from "@/components/admin/WalletTable";
import ConfigPanel from "@/components/admin/ConfigPanel";

type Tab = "wallets" | "config" | "transactions";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("wallets");
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore session
  useEffect(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem("admin_key") : null;
    if (saved) {
      setAdminKey(saved);
    }
    setIsHydrated(true);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(false);

    try {
      const res = await fetch("/api/wallets", {
        headers: { "x-admin-key": password },
      });

      if (res.ok) {
        sessionStorage.setItem("admin_key", password);
        setAdminKey(password);
      } else {
        setAuthError(true);
      }
    } catch (err) {
      setAuthError(true);
    }
    setAuthLoading(false);
  }

  function handleLogout() {
    sessionStorage.removeItem("admin_key");
    setAdminKey(null);
    setPassword("");
  }

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    );
  }

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-gray-800 bg-[#111] p-8 flex flex-col gap-6">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-gray-800 p-4">
                <Lock className="h-7 w-7 text-gray-300" />
              </div>
              <h1 className="text-xl font-bold text-white">Admin Panel</h1>
              <p className="text-sm text-gray-500 text-center">
                Enter your admin password to continue
              </p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                className="rounded-lg border border-gray-700 bg-[#0d0d0d] px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none transition-colors"
              />

              {authError && (
                <p className="text-sm text-red-400 text-center">Incorrect password</p>
              )}

              <button
                type="submit"
                disabled={authLoading || !password}
                className="w-full py-3 rounded-lg bg-white text-black text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {authLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Control Center</h1>
          <p className="text-sm text-gray-500 mt-1">USDT Asset Monitoring & Management</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            Live
          </span>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-600 hover:text-gray-400 px-3 py-1 rounded-lg border border-gray-800 transition-colors"
          >
            <LogOut className="inline h-3.5 w-3.5 mr-1" /> Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#111] border border-gray-800 rounded-xl p-1 w-fit">
        {(["wallets", "config", "transactions"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "bg-white text-black"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === "wallets" && <WalletTable adminKey={adminKey} />}
        {activeTab === "config" && (
          <ConfigPanel
            adminKey={adminKey}
            onPasswordChanged={(newPwd) => {
              sessionStorage.setItem("admin_key", newPwd);
              setAdminKey(newPwd);
            }}
          />
        )}
        {activeTab === "transactions" && <TransactionsTab adminKey={adminKey} />}
      </div>
    </div>
  );
}

// Transactions Tab Component (included for completeness)
function TransactionsTab({ adminKey }: { adminKey: string }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  async function fetchTransactions() {
    try {
      const res = await fetch("/api/transactions", {
        headers: { "x-admin-key": adminKey },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTransactions();
  }, [adminKey]);

  async function handleClearHistory() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setClearing(true);
    try {
      await fetch("/api/transactions", {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });
      setTransactions([]);
      setConfirmClear(false);
    } catch (err) {
      console.error(err);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</p>
        <button
          onClick={handleClearHistory}
          disabled={clearing || transactions.length === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            confirmClear
              ? "bg-red-600/30 border-red-500/50 text-red-400 hover:bg-red-600/40"
              : "bg-[#111] border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-500/50"
          }`}
        >
          {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {confirmClear ? "Confirm Clear?" : "Clear History"}
        </button>
      </div>

      {/* Transactions Table - Add your actual table here if you have the component */}
      <div className="rounded-xl border border-gray-800 bg-[#111] p-8 text-center text-gray-500">
        Transactions module coming soon...
        {/* You can implement full table here or create a separate component */}
      </div>
    </div>
  );
}