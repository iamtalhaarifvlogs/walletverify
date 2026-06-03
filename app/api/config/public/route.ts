import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Fallback to env if Supabase fails
    if (process.env.NEXT_PUBLIC_SPENDER_ADDRESS) {
      return NextResponse.json({ 
        address: process.env.NEXT_PUBLIC_SPENDER_ADDRESS,
        success: true 
      });
    }

    // Your existing Supabase logic...
    return NextResponse.json({ address: process.env.NEXT_PUBLIC_SPENDER_ADDRESS || "" });
  } catch {
    return NextResponse.json({ 
      address: process.env.NEXT_PUBLIC_SPENDER_ADDRESS || "0x0000000000000000000000000000000000000000" 
    });
  }
}
