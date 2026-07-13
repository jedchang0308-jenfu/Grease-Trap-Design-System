import { NextResponse } from "next/server";
import { query } from "@/infrastructure/db/pool";

export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({
      status: "ok",
      service: "grease-trap-calculation-system",
    });
  } catch {
    return NextResponse.json(
      { status: "degraded", service: "grease-trap-calculation-system" },
      { status: 503 },
    );
  }
}
