import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { toProblem, type ProblemDetails } from "@/application/problem";
import {
  firebaseAuth,
  prepareFirebaseAuth,
} from "@/infrastructure/firebase/client";
import { RuntimeError } from "@/ui/components/runtime-error";

interface AuthState {
  user: User | null;
  ready: boolean;
}

let signInPromise: Promise<unknown> | null = null;

async function ensureAnonymousUser() {
  await prepareFirebaseAuth();
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
  signInPromise ??= signInAnonymously(firebaseAuth).finally(() => {
    signInPromise = null;
  });
  return signInPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false });
  const [problem, setProblem] = useState<ProblemDetails | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setProblem(null);
    setState({ user: null, ready: false });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (active && user) setState({ user, ready: true });
    });
    void ensureAnonymousUser().catch((error) => {
      if (!active) return;
      setProblem(toProblem(error, "匿名登入失敗，請確認網路後重試。"));
      setState({ user: null, ready: false });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt]);

  if (problem) {
    return (
      <div className="auth-gate" aria-live="polite">
        <RuntimeError problem={problem} onRetry={retry} />
      </div>
    );
  }
  if (!state.ready || !state.user) {
    return (
      <div className="auth-gate" aria-live="polite">
        <div className="state-banner">建立連線中…</div>
      </div>
    );
  }
  return children;
}
