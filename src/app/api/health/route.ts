import { NextResponse } from "next/server";
import { dataHealthcheck } from "@/application/cases/repository";
import { env } from "@/config/env";

export async function GET() {
  try {
    await dataHealthcheck();
    return NextResponse.json({
      status: "ok",
      service: "grease-trap-calculation-system",
      dataBackend: env.DATA_BACKEND,
    });
  } catch {
    return NextResponse.json(
      { status: "degraded", service: "grease-trap-calculation-system" },
      { status: 503 },
    );
  }
}
