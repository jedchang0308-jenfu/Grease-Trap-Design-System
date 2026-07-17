import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export interface ProblemDetails {
  code: string;
  title: string;
  userMessage: string;
  status: number;
  fieldErrors?: Record<string, string[]>;
  retryable?: boolean;
  correlationId?: string;
}

export class AppProblem extends Error {
  constructor(public readonly details: ProblemDetails) {
    super(details.userMessage);
  }
}

export function problemResponse(problem: ProblemDetails) {
  return NextResponse.json(
    { ...problem, correlationId: problem.correlationId ?? randomUUID() },
    {
      status: problem.status,
      headers: { "content-type": "application/problem+json" },
    },
  );
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!value || typeof value !== "object") return false;
  const problem = value as Partial<ProblemDetails>;
  return (
    typeof problem.code === "string" &&
    typeof problem.title === "string" &&
    typeof problem.userMessage === "string" &&
    typeof problem.status === "number"
  );
}

export function toProblemResponse(error: unknown) {
  if (error instanceof AppProblem) return problemResponse(error.details);
  if (error && typeof error === "object" && "details" in error) {
    const details = (error as { details?: unknown }).details;
    if (isProblemDetails(details)) return problemResponse(details);
  }
  console.error(error);
  return problemResponse({
    code: "UNEXPECTED_ERROR",
    title: "操作未完成",
    userMessage: "目前未完成這次操作，已填資料仍保留。請重試或回到安全頁面。",
    status: 500,
    retryable: true,
  });
}
