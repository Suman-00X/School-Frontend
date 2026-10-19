import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { errorMessage, isApiError, sessionStore } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useForm } from "@/common/hooks";
import { Alert, Button, PasswordInput, TextInput } from "@/common/ui";
import { AuthLayout } from "../../shared/components/AuthLayout";
import { formatWait, retryAfterSeconds, useCooldown } from "../../shared/hooks/useCooldown";
import { login } from "../api/sessions";

type Problem = { message: string; offerReset?: boolean };

/* SH-01 */
export default function SignInPage() {
  const { signIn, endedMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from;

  const form = useForm({ schoolCode: search.get("school") ?? sessionStore.lastSchoolCode, email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const cooldown = useCooldown();
  const { values } = form;
  const resetLink = `/forgot-password${values.schoolCode.trim() ? `?school=${encodeURIComponent(values.schoolCode.trim())}` : ""}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    form.setErrors({});
    form.setFormError(null);
    try {
      const res = await login({ schoolCode: values.schoolCode.trim(), email: values.email.trim(), password: values.password });
      /* Navigate while the session boots, so the public-only guard doesn't send us home first */
      const booting = signIn(res.data);
      navigate(from && !from.startsWith("/sign-in") ? from : "/", { replace: true });
      await booting;
    } catch (err) {
      setBusy(false);
      if (!isApiError(err)) return setProblem({ message: errorMessage(err) });
      if (err.isValidation) return form.setServerErrors(err);
      if (err.status === 429) {
        cooldown.start(retryAfterSeconds(err));
        return setProblem({ message: err.message, offerReset: true });
      }
      if (err.status === 401) {
        form.set("password", "");
        return setProblem({ message: err.message || "The school code, email or password is incorrect" });
      }
      if (err.status === 403) return setProblem({ message: err.message || "This account is disabled. Please contact the school office." });
      setProblem({ message: errorMessage(err) });
    }
  };

  const waiting = cooldown.secondsLeft > 0;

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use the school code and email your school gave you."
      footer={
        <>
          <Link to={resetLink}>Forgot password?</Link>
          <button type="button" className="btn btn-link" onClick={() => setShowHelp(s => !s)} aria-expanded={showHelp}>
            First time here?
          </button>
        </>
      }
    >
      {endedMessage && !problem && <Alert tone="warning">{endedMessage}</Alert>}
      {problem && (
        <Alert tone="danger" action={problem.offerReset ? <Link to={resetLink} className="nowrap">Reset password</Link> : undefined}>
          {problem.message}
        </Alert>
      )}
      {form.formError && !problem && <Alert tone="danger">{form.formError}</Alert>}

      <form className="stack" onSubmit={e => void submit(e)} noValidate>
        <TextInput
          label="School code"
          required
          minLength={2}
          maxLength={20}
          autoComplete="organization"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus={!values.schoolCode}
          {...form.text("schoolCode")}
        />
        <TextInput label="Email" type="email" required autoComplete="username" autoFocus={!!values.schoolCode} {...form.text("email")} />
        <PasswordInput label="Password" required maxLength={128} autoComplete="current-password" {...form.text("password")} />
        <Button
          type="submit"
          variant="primary"
          block
          loading={busy}
          disabled={waiting || !values.schoolCode.trim() || !values.email.trim() || !values.password}
        >
          {waiting ? `Try again in ${formatWait(cooldown.secondsLeft)}` : "Sign in"}
        </Button>
      </form>

      {showHelp && (
        <Alert tone="info" title="First time here?">
          Ask the school office to send you an invitation email, then use its link to set your password. If the invitation has
          expired, <Link to={resetLink}>request a password link</Link> instead.
        </Alert>
      )}
    </AuthLayout>
  );
}
