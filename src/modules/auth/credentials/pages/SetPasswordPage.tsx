import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { endSession, errorMessage, isApiError, sessionStore } from "@/common/api";
import { useForm } from "@/common/hooks";
import { Alert, Button, ButtonLink, EmptyState, PasswordChecklist, PasswordInput, passwordOk } from "@/common/ui";
import { AuthLayout } from "../../shared/components/AuthLayout";
import { AuthStatus } from "../../shared/components/AuthStatus";
import { formatWait, retryAfterSeconds, useCooldown } from "../../shared/hooks/useCooldown";
import { resetPassword } from "../api/passwords";

/* mode "reset": /reset-password (SH-02 step 2); mode "invite": /set-password (SH-03) */
export default function SetPasswordPage({ mode = "reset" }: { mode?: "reset" | "invite" }) {
  const [search] = useSearchParams();
  const token = search.get("token") ?? "";
  const school = search.get("school")?.trim() ?? "";
  const withSchool = (path: string) => (school ? `${path}?school=${encodeURIComponent(school)}` : path);

  const form = useForm({ password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState<string | null>(token ? null : "This link is incomplete. Open it again from the email.");
  const cooldown = useCooldown();
  const { password, confirm } = form.values;
  const mismatch = confirm.length > 0 && confirm !== password;

  const title = mode === "invite" ? (school ? `Set your password for ${school}` : "Set your password") : "Choose a new password";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    form.setFormError(null);
    try {
      const res = await resetPassword({ token, password });
      /* Every device of the account was signed out: drop any tokens kept here */
      if (sessionStore.get()) endSession();
      if (school) sessionStore.lastSchoolCode = school;
      setDone(res.message || (mode === "invite" ? "Password set. You can now sign in." : "Password changed. Please sign in again."));
    } catch (err) {
      if (isApiError(err) && err.status === 422) setLinkInvalid(err.message);
      else if (isApiError(err) && err.status === 429) {
        cooldown.start(retryAfterSeconds(err));
        form.setFormError(err.message);
      } else if (isApiError(err) && err.isValidation) form.setServerErrors(err);
      else form.setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <AuthLayout title={title} schoolCode={school}>
        <EmptyState
          icon={<CheckCircle2 />}
          title={done}
          actions={
            <ButtonLink to={withSchool("/sign-in")} variant="primary">
              Sign in
            </ButtonLink>
          }
        />
      </AuthLayout>
    );

  if (linkInvalid)
    return (
      <AuthLayout title={title} schoolCode={school} footer={<Link to={withSchool("/sign-in")}>Back to sign in</Link>}>
        <Alert tone="danger" title={linkInvalid}>
          {mode === "invite"
            ? "Ask the school office to send a new invitation, or request a password link yourself."
            : "Reset links work once and expire after 1 hour."}
        </Alert>
        <ButtonLink to={withSchool("/forgot-password")} variant="primary">
          {mode === "invite" ? "Forgot password" : "Ask for a new link"}
        </ButtonLink>
      </AuthLayout>
    );

  const waiting = cooldown.secondsLeft > 0;
  return (
    <AuthLayout
      title={title}
      schoolCode={school}
      subtitle={mode === "invite" ? "Welcome! This link works once and lasts 7 days." : undefined}
      footer={<Link to={withSchool("/sign-in")}>Back to sign in</Link>}
    >
      <form className="stack" onSubmit={e => void submit(e)} noValidate>
        <div className="stack-sm">
          <PasswordInput label="New password" required maxLength={128} autoComplete="new-password" autoFocus {...form.text("password")} />
          <PasswordChecklist password={password} />
        </div>
        <PasswordInput
          label="Confirm password"
          required
          maxLength={128}
          autoComplete="new-password"
          {...form.text("confirm")}
          error={mismatch ? "The passwords don't match" : form.errors.confirm}
        />
        <Button type="submit" variant="primary" block loading={busy} disabled={waiting || !passwordOk(password) || confirm !== password}>
          {waiting ? `Try again in ${formatWait(cooldown.secondsLeft)}` : mode === "invite" ? "Set my password" : "Set the new password"}
        </Button>
      </form>
      <AuthStatus problem={form.formError ? { message: form.formError } : null} />
    </AuthLayout>
  );
}
