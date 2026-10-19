import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { errorMessage, isApiError, sessionStore } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useForm } from "@/common/hooks";
import { Avatar, Badge, Button, Dialog, PasswordInput, roleLabel, TextInput } from "@/common/ui";
import { AuthLayout } from "../../shared/components/AuthLayout";
import { AuthStatus, type Problem } from "../../shared/components/AuthStatus";
import { formatWait, retryAfterSeconds, useCooldown } from "../../shared/hooks/useCooldown";
import { isChooseSchool, login, type SchoolChoice } from "../api/sessions";

/* SH-01. Email and password only; when the password is right in several schools,
   the person picks one (the server lists only schools where the password matched). */
export default function SignInPage() {
  const { signIn, endedMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from;
  /* Reset and invitation links name the school: sign straight in to it */
  const linkedSchool = search.get("school")?.trim() || null;

  const form = useForm({ email: "", password: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [schools, setSchools] = useState<SchoolChoice[] | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const cooldown = useCooldown();
  const { values } = form;

  const finish = async (data: Parameters<typeof signIn>[0]) => {
    /* Navigate while the session boots, so the public-only guard doesn't send us home first */
    const booting = signIn(data);
    navigate(from && !from.startsWith("/sign-in") ? from : "/", { replace: true });
    await booting;
  };

  const attempt = async (pick?: SchoolChoice) => {
    setBusy(pick?.id ?? "form");
    setProblem(null);
    form.setErrors({});
    try {
      const res = await login({
        email: values.email.trim(),
        password: values.password,
        ...(pick ? { schoolId: pick.id } : linkedSchool ? { schoolCode: linkedSchool } : {})
      });
      if (isChooseSchool(res.data)) {
        const last = sessionStore.lastSchoolCode;
        /* The school used last on this device comes first */
        setSchools([...res.data.schools].sort((a, b) => Number(b.code === last) - Number(a.code === last)));
        setBusy(null);
        return;
      }
      await finish(res.data);
    } catch (err) {
      setBusy(null);
      if (!isApiError(err)) return setProblem({ message: errorMessage(err) });
      if (err.isValidation) return form.setServerErrors(err);
      if (err.status === 429) {
        cooldown.start(retryAfterSeconds(err));
        return setProblem({ message: err.message, offerReset: true });
      }
      if (err.status === 401) {
        form.set("password", "");
        setSchools(null);
        return setProblem({ message: err.message || "The email or password is incorrect" });
      }
      setProblem({ message: errorMessage(err) });
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void attempt();
  };

  const waiting = cooldown.secondsLeft > 0;
  const status = problem ?? (endedMessage ? { message: endedMessage } : null);

  /* Step 2: choose a school */
  if (schools)
    return (
      <AuthLayout
        title="Choose a school"
        subtitle={`${values.email.trim()} has an account in ${schools.length} schools.`}
        footer={
          <button
            type="button"
            className="btn btn-link"
            onClick={() => {
              setSchools(null);
              form.set("password", "");
            }}
          >
            <ArrowLeft size={14} /> Use a different account
          </button>
        }
      >
        <div className="school-list" role="list">
          {schools.map(s => (
            <button
              key={s.id}
              type="button"
              role="listitem"
              className="school-option"
              disabled={!!busy}
              aria-busy={busy === s.id}
              onClick={() => void attempt(s)}
            >
              {s.logoUrl ? (
                <span className="avatar">
                  <img src={s.logoUrl} alt="" />
                </span>
              ) : (
                <Avatar name={s.name} />
              )}
              <span className="school-option-text">
                <span className="school-option-name">{s.name}</span>
                <span className="school-option-meta">
                  <span className="mono">{s.code}</span> · {roleLabel(s.role)}
                </span>
              </span>
              {s.code === sessionStore.lastSchoolCode && <Badge tone="primary">Last used</Badge>}
              <ChevronRight size={16} className="muted" />
            </button>
          ))}
        </div>
        <AuthStatus problem={problem} />
      </AuthLayout>
    );

  /* Step 1: email and password */
  return (
    <AuthLayout
      title="Sign in"
      subtitle={linkedSchool ? <>Signing in to <span className="mono">{linkedSchool}</span>.</> : "Use the email your school gave you."}
      footer={
        <>
          <Link to={linkedSchool ? `/forgot-password?school=${encodeURIComponent(linkedSchool)}` : "/forgot-password"}>Forgot password?</Link>
          <button type="button" className="btn btn-link" onClick={() => setShowHelp(true)}>
            First time here?
          </button>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        <TextInput label="Email" type="email" required autoComplete="username" autoFocus {...form.text("email")} />
        <PasswordInput label="Password" required maxLength={128} autoComplete="current-password" {...form.text("password")} />
        <Button type="submit" variant="primary" block loading={busy === "form"} disabled={waiting || !values.email.trim() || !values.password}>
          {waiting ? `Try again in ${formatWait(cooldown.secondsLeft)}` : "Sign in"}
        </Button>
      </form>
      <AuthStatus problem={status} tone={problem ? "danger" : "warning"} />

      <Dialog open={showHelp} onClose={() => setShowHelp(false)} title="First time here?" footer={<Button onClick={() => setShowHelp(false)}>Close</Button>}>
        Ask the school office to send you an invitation email, then use its link to set your password. If the invitation has expired,{" "}
        <Link to="/forgot-password">request a password link</Link> instead.
      </Dialog>
    </AuthLayout>
  );
}
