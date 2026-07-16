import type { UiProblem } from "@/ui/components/runtime-error";

export class UiRequestError extends Error {
  constructor(public readonly problem: UiProblem) {
    super(problem.userMessage ?? "操作未完成");
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = body as UiProblem & { code?: string };
    throw new UiRequestError(problem);
  }
  return body as T;
}
