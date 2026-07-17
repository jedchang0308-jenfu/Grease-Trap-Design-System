"use client";

import { signInAnonymously, signOut } from "firebase/auth";
import { useEffect, useState, type ReactNode } from "react";
import {
  getFirebaseAuth,
  setEphemeralFirebaseAuth,
} from "@/infrastructure/firebase/client";
import type { UiProblem } from "@/ui/components/runtime-error";

type GateState = "checking" | "ready" | "error";

let sessionBootstrap: Promise<void> | null = null;

async function responseProblem(response: Response): Promise<UiProblem> {
  const body = (await response.json().catch(() => ({}))) as UiProblem;
  return {
    code: body.code,
    userMessage: body.userMessage ?? "目前無法進入系統，請稍後重試。",
  };
}

async function establishPublicSession() {
  const currentSession = await fetch("/api/auth/status", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!currentSession.ok) throw await responseProblem(currentSession);
  const status = (await currentSession.json()) as { authenticated?: boolean };
  if (status.authenticated) return;

  const firebaseAuth = getFirebaseAuth();
  await setEphemeralFirebaseAuth(firebaseAuth);
  const credential = await signInAnonymously(firebaseAuth);

  try {
    const idToken = await credential.user.getIdToken();
    const response = await fetch("/api/auth/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) throw await responseProblem(response);
  } finally {
    await signOut(firebaseAuth).catch(() => undefined);
  }
}

function ensurePublicSession() {
  if (!sessionBootstrap) {
    sessionBootstrap = establishPublicSession().catch((error) => {
      sessionBootstrap = null;
      throw error;
    });
  }
  return sessionBootstrap;
}

function normalizeProblem(error: unknown): UiProblem {
  const candidate = error as UiProblem;
  return {
    code: candidate?.code,
    userMessage:
      candidate?.userMessage ??
      "目前無法建立使用階段，請稍後重試或聯絡管理者。",
  };
}

export function PublicSessionGate({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [state, setState] = useState<GateState>(enabled ? "checking" : "ready");
  const [problem, setProblem] = useState<UiProblem | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState("checking");
    setProblem(null);
    void ensurePublicSession().then(
      () => {
        if (active) setState("ready");
      },
      (error) => {
        if (!active) return;
        setProblem(normalizeProblem(error));
        setState("error");
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, enabled]);

  if (state === "ready") return children;

  return (
    <div className="page auth-page">
      <section className="panel auth-panel" aria-live="polite">
        <h1>{state === "checking" ? "正在進入系統" : "目前無法進入系統"}</h1>
        <p className={state === "error" ? "runtime-error" : "state-banner"}>
          {state === "checking"
            ? "正在建立安全使用階段。"
            : problem?.userMessage}
        </p>
        {state === "error" ? (
          <button
            className="button primary"
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            重試
          </button>
        ) : null}
      </section>
    </div>
  );
}
