import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage, isApiError } from "@/common/api";
import { useForm } from "@/common/hooks";
import { Button, PageLoader, PasswordInput, TextInput } from "@/common/ui";
import { AuthLayout } from "@/modules/auth/shared/components/AuthLayout";
import { platformKeys, systemAdminLogin } from "../api/schools";
import { consoleSession } from "../api/session";
import { useSystemAdmin } from "../shared/useSystemAdmin";

/* PL-01. System admins only (the platform's owners): school accounts sign in at /sign-in.
   The session is a cookie the page never sees. */
export default function SystemAdminSignInPage() {
  const me = useSystemAdmin();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const next = from?.startsWith("/adminConsole") && !from.startsWith("/adminConsole/sign-in") ? from : "/adminConsole";
  const form = useForm({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(() => consoleSession.takeEndedMessage());

  if (me.isPending) return <PageLoader />;
  if (me.data) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const res = await systemAdminLogin({ email: form.values.email.trim(), password: form.values.password });
      qc.setQueryData(platformKeys.me, res.data.systemAdmin);
      navigate(next, { replace: true });
    } catch (err) {
      setBusy(false);
      if (isApiError(err) && err.isValidation) return form.setServerErrors(err);
      if (isApiError(err) && err.status === 401) form.set("password", "");
      setProblem(errorMessage(err));
    }
  };

  return (
    <AuthLayout title="Admin console" subtitle="For the platform's system admins: onboard schools and manage tenants.">
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
