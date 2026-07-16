import { redirect } from "next/navigation";
import { env } from "@/config/env";
import { LoginForm } from "@/ui/auth/login-form";

export default function LoginPage() {
  if (env.AUTH_BACKEND === "local") redirect("/cases");
  return (
    <div className="page auth-page">
      <LoginForm />
    </div>
  );
}
