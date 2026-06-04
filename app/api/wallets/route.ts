import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { isAdminAuthorized } from "@/lib/auth";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // ← This is key
);

// GET - Fetch all wallets (for Admin)

export async function GET(req: NextRequest) {
  try {
    console.log("=== Wallets API Debug Start ===");
    console.log("SUPABASE_URL exists?", !!process.env.SUPABASE_URL);
    console.log("SUPABASE_SERVICE_ROLE_KEY exists?", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .limit(3);   // smaller query for testing

    console.log("Query result:", { data: data?.length, error });

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json({ 
        error: "Database error", 
        details: error.message,
        code: error.code 
      }, { status: 500 });
    }

    return NextResponse.json({ wallets: data || [] });

  } catch (err: any) {
    console.error("Full Server Error:", err);
    return NextResponse.json({ 
      error: "Server error", 
      message: err.message,
      stack: err.stack 
    }, { status: 500 });
  }
}

// POST - Record new approval (public)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, approvalTxHash, approvalStatus } = body;

    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from("wallets")
      .insert({
        address,
        approvalTxHash: approvalTxHash || null,
        approvalStatus: approvalStatus ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}