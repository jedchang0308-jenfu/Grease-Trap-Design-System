import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { toProblemResponse } from "@/application/http/problem";
import { query } from "@/infrastructure/db/pool";

export async function GET(request: Request) {
  try {
    await requireUser(request.headers);
    const result = await query(
      `SELECT rs.id, rs.code, rs.version, rs.method_family AS "methodFamily", rs.status,
              rs.checksum, rs.activated_at AS "activatedAt", sd.title AS source, sd.sha256 AS "sourceHash"
         FROM rule_sets rs JOIN source_documents sd ON sd.id=rs.source_document_id
        ORDER BY rs.method_family, rs.created_at DESC`,
    );
    return NextResponse.json({ items: result.rows });
  } catch (error) {
    return toProblemResponse(error);
  }
}
