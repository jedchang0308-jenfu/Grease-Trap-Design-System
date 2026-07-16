"use client";

import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { FormEvent, useState } from "react";
import {
  getFirebaseAuth,
  setEphemeralFirebaseAuth,
} from "@/infrastructure/firebase/client";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";

export function LoginForm() {
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<UiProblem | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setProblem(null);
    const form = new FormData(event.currentTarget);
    try {
      const firebaseAuth = getFirebaseAuth();
      await setEphemeralFirebaseAuth(firebaseAuth);
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        String(form.get("email") ?? ""),
        String(form.get("password") ?? ""),
      );
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw body;
      await signOut(firebaseAuth);
      const next = new URLSearchParams(window.location.search).get("next");
      const destination =
        next?.startsWith("/") && !next.startsWith("//") ? next : "/cases";
      window.location.assign(destination);
    } catch (error) {
      const candidate = error as UiProblem;
      setProblem({
        userMessage:
          candidate.userMessage ?? "帳號或密碼無效，請確認後重新登入。",
      });
      setSubmitting(false);
    }
  }

  return (
    <form className="panel auth-panel" onSubmit={submit}>
      <h1>內部帳號登入</h1>
      {problem ? <RuntimeError problem={problem} /> : null}
      <div className="field">
        <label htmlFor="email">電子郵件</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">密碼</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button className="button primary" type="submit" disabled={submitting}>
        {submitting ? "正在登入…" : "登入"}
      </button>
    </form>
  );
}
