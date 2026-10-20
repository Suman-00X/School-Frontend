import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { errorMessage, isApiError } from "@/common/api";
import { useForm } from "@/common/hooks";
import { Button, PasswordInput, TextInput } from "@/common/ui";
import { AuthLayout } from "@/modules/auth/shared/components/AuthLayout";
import { operatorLogin } from "../api/schools";
import { operatorSession } from "../api/session";
import { useOperator } from "../shared/useOperator";

/* PL-01. Operators only: school accounts sign in at /sign-in */
export default function OperatorSignInPage() {
  const session = useOperator();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const form = useForm({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(operatorSession.endedMessage);

  if (session) return <Navigate to={from?.startsWith("/platform") ? from : "/platform"} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const res = await operatorLogin({ email: form.values.email.trim(), password: form.values.password });
      operatorSession.set({
        accessToken: res.data.accessToken,
        expiresAt: Date.now() + res.data.expiresIn * 1000,
        operator: res.data.operator
      });
      navigate(from?.startsWith("/platform") ? from : "/platform", { replace: true });
    } catch (err) {
      setBusy(false);
      if (isApiError(err) && err.isValidation) return form.setServerErrors(err);
      if (isApiError(err) && err.status === 401) form.set("password", "");
      setProblem(errorMessage(err));
    }
  };

  return (
    <AuthLayout title="Onboarding portal" subtitle="Sign in with your operator account to set up schools.">
      <form className="stack" onSubmit={e => void submit(e)} noValidate>
        <TextInput label="Email" type="email" required autoComplete="username" autoFocus {...form.text("email")} />
        <PasswordInput label="Password" required maxLength={128} autoComplete="current-password" {...form.text("password")} />
        {problem && (
          <div className="auth-status auth-status-danger" role="alert">
            {problem}
          </div>
        )}
        <Button type="submit" variant="primary" block loading={busy} disabled={!form.values.email.trim() || !form.values.password}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
