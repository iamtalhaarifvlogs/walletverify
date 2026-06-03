import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    address: "0x36a4D5f9d1c2AA15C6409e3588995D140ee32B04"
  });
}