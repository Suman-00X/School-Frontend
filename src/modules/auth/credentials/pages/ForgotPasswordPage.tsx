import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { errorMessage, isApiError } from "@/common/api";
import { useForm } from "@/common/hooks";
import { Button, ButtonLink, EmptyState, TextInput } from "@/common/ui";
import { AuthLayout } from "../../shared/components/AuthLayout";
import { AuthStatus } from "../../shared/components/AuthStatus";
import { formatWait, retryAfterSeconds, useCooldown } from "../../shared/hooks/useCooldown";
import { requestPasswordReset } from "../api/passwords";

/* SH-02 step 1 */
export default function ForgotPasswordPage() {
  const [search] = useSearchParams();
  /* A link may name the school; otherwise every school with this email sends its own link */
  const schoolCode = search.get("school")?.trim() || "";
  const form = useForm({ email: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const cooldown = useCooldown();
  const { values } = form;
  const signInLink = `/sign-in${schoolCode ? `?school=${encodeURIComponent(schoolCode)}` : ""}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    form.setFormError(null);
    try {
      const res = await requestPasswordReset({ email: values.email.trim(), ...(schoolCode ? { schoolCode } : {}) });
      setSent(res.message || "If an account matches, we have emailed a link to reset the password.");
    } catch (err) {
      if (isApiError(err) && err.status === 429) {
        cooldown.start(retryAfterSeconds(err));
        form.setFormError(err.message);
      } else if (isApiError(err) && err.isValidation) form.setServerErrors(err);
      else form.setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <AuthLayout title="Check your email" schoolCode={schoolCode}>
        <EmptyState
          icon={<MailCheck />}
          title={sent}
          message="If you have accounts in several schools, each school sends its own link. Links expire in 1 hour; check your spam folder if one doesn't arrive."
          actions={<ButtonLink to={signInLink}>Back to sign in</ButtonLink>}
        />
      </AuthLayout>
    );

  const waiting = cooldown.secondsLeft > 0;
  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="We'll email you a link to set a new one. It also works if you never set a password."
      footer={<Link to={signInLink}>Back to sign in</Link>}
    >
      <form className="stack" onSubmit={e => void submit(e)} noValidate>
        <TextInput label="Email" type="email" required autoComplete="username" autoFocus {...form.text("email")} />
        <Button type="submit" variant="primary" block loading={busy} disabled={waiting || !values.email.trim()}>
          {waiting ? `Try again in ${formatWait(cooldown.secondsLeft)}` : "Send me a reset link"}
        </Button>
      </form>
      <AuthStatus problem={form.formError ? { message: form.formError } : null} />
    </AuthLayout>
  );
}
