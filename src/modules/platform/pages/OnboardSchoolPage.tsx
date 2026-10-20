import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { compact, useDebounce, useForm } from "@/common/hooks";
import { Button, ButtonLink, Card, ErrorState, FormActions, Page, PageHeader, Select, SkeletonBlock, TextInput, Textarea, useToast } from "@/common/ui";
import { countryOptions, currencyOptions, timeZoneOptions } from "@/modules/administration";
import { checkCode, useModuleCatalogue, useOnboardSchool, type Invitation, type SchoolDetail } from "../api/schools";
import { InvitationPanel } from "../components/InvitationPanel";
import { ModuleSwitchboard } from "../components/ModuleSwitchboard";

type Values = {
  /* The school */
  name: string;
  code: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  description: string;
  timezone: string;
  currency: string;
  country: string;
  /* Its first administrator */
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
};

const INITIAL: Values = {
  name: "",
  code: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
  description: "",
  timezone: "Asia/Kolkata",
  currency: "INR",
  country: "IN",
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  phone: ""
};

const REQUIRED: (keyof Values)[] = ["name", "code", "contactEmail", "contactPhone", "address", "firstName", "lastName", "email"];

const CODE = /^[A-Z0-9-]{2,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Server errors name the nested field ("school.code", "admin.email"); the form's are flat */
const FIELD_MAP: Record<string, string> = Object.fromEntries([
  ...["name", "code", "contactEmail", "contactPhone", "address", "description", "timezone", "currency", "country"].map(k => [`school.${k}`, k]),
  ...["firstName", "middleName", "lastName", "email", "phone"].map(k => [`admin.${k}`, k])
]);

/* A suggested code from the name: initials of its words ("Green Valley School" -> GVS) */
const suggestCode = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);

/* PL-03. One page: the school, its first administrator and its modules. Creating the
   school's databases takes a little while; the administrator is then emailed a link. */
export default function OnboardSchoolPage() {
  const catalogue = useModuleCatalogue();
  const onboard = useOnboardSchool();
  const toast = useToast();
  const form = useForm<Values>(INITIAL);
  const { values } = form;
  /* Every add-on module starts switched on; the operator switches off what the school doesn't buy */
  const [picked, setModules] = useState<string[] | null>(null);
  const modules = picked ?? (catalogue.data ? catalogue.data.filter(m => !m.core).map(m => m.key) : null);
  const [codeTouched, setCodeTouched] = useState(false);
  const [done, setDone] = useState<{ school: SchoolDetail; invitation: Invitation; email: string } | null>(null);
  const code = useCodeCheck(values.code);

  if (done) return <Onboarded {...done} onAnother={() => { form.reset(INITIAL); setModules(null); setCodeTouched(false); setDone(null); }} />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    for (const key of REQUIRED) if (!values[key].trim()) errors[key] = "is required";
    if (values.code.trim() && !CODE.test(values.code.trim())) errors.code = "2-20 letters, digits or dashes";
    if (code.state === "taken") errors.code = "is already taken";
    for (const key of ["contactEmail", "email"] as const) if (values[key].trim() && !EMAIL.test(values[key].trim())) errors[key] = "is not an email address";
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      form.setFormError("Please correct the highlighted fields.");
      return;
    }
    form.setFormError(null);
    const v = Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x.trim()])) as Values;
    onboard.mutate(
      {
        school: {
          ...compact({ description: v.description }),
          name: v.name,
          code: v.code,
          address: v.address,
          contactEmail: v.contactEmail,
          contactPhone: v.contactPhone,
          timezone: v.timezone,
          currency: v.currency,
          country: v.country
        },
        admin: { ...compact({ middleName: v.middleName, phone: v.phone }), firstName: v.firstName, lastName: v.lastName, email: v.email },
        modules: modules ?? []
      },
      {
        onSuccess: res => {
          toast.success(res.message);
          setDone({ ...res.data, email: v.email.toLowerCase() });
          window.scrollTo({ top: 0 });
        },
        onError: err => form.setServerErrors(err, FIELD_MAP)
      }
    );
  };

  const busy = onboard.isPending;
  const field = (key: keyof Values) => ({ ...form.text(key), disabled: busy });

  return (
    <Page>
      <PageHeader
        title="Onboard a school"
        subtitle="The school gets its own databases. Its administrator is emailed a link to set a password and sign in."
        breadcrumbs={[{ label: "Schools", to: "/platform" }, { label: "Onboard a school" }]}
      />
      <form className="onboard-layout" onSubmit={submit} noValidate>
        <div className="stack">
          <Card title="School" subtitle="How the school appears on documents, messages and at sign-in">
            <div className="form-grid">
              <TextInput
                label="School name"
                required
                maxLength={150}
                {...field("name")}
                onChange={e => {
                  form.set("name", e.target.value);
                  if (!codeTouched) form.set("code", suggestCode(e.target.value));
                }}
              />
              <TextInput
                label="School code"
                required
                maxLength={20}
                className="mono"
                hint={<CodeHint state={code.state} code={values.code.trim().toUpperCase()} />}
                {...field("code")}
                onChange={e => {
                  setCodeTouched(true);
                  form.set("code", e.target.value.toUpperCase().replace(/\s+/g, ""));
                }}
              />
              <TextInput label="Contact email" type="email" required maxLength={254} placeholder="office@school.edu" {...field("contactEmail")} />
              <TextInput label="Contact phone" type="tel" required placeholder="+91 98765 43210" {...field("contactPhone")} />
              <Textarea label="Address" required rows={2} maxLength={500} fieldClassName="span-2" {...field("address")} />
              <Textarea label="Description" rows={2} maxLength={1000} fieldClassName="span-2" hint="Optional. A line about the school." {...field("description")} />
            </div>
          </Card>
          <Card title="Region" subtitle="Dates and money in the school follow these">
            <div className="form-grid form-grid-3">
              <Select label="Time zone" required options={timeZoneOptions(values.timezone)} {...field("timezone")} />
              <Select label="Currency" required options={currencyOptions(values.currency)} {...field("currency")} />
              <Select label="Country" required options={countryOptions(values.country)} {...field("country")} />
            </div>
          </Card>
          <Card title="Administrator" subtitle="The first account of the school. They add everyone else.">
            <div className="form-grid form-grid-3">
              <TextInput label="First name" required maxLength={100} autoComplete="off" {...field("firstName")} />
              <TextInput label="Middle name" maxLength={100} autoComplete="off" {...field("middleName")} />
              <TextInput label="Last name" required maxLength={100} autoComplete="off" {...field("lastName")} />
              <TextInput label="Email" type="email" required maxLength={254} autoComplete="off" hint="They sign in with this email." fieldClassName="span-2" {...field("email")} />
              <TextInput label="Phone" type="tel" placeholder="+91 98765 43210" {...field("phone")} />
            </div>
          </Card>
          <Card title="Modules" subtitle="The school sees and uses only the modules switched on. You can change this later.">
            {catalogue.error ? (
              <ErrorState error={catalogue.error} onRetry={() => void catalogue.refetch()} />
            ) : !catalogue.data || modules === null ? (
              <SkeletonBlock lines={6} />
            ) : (
              <ModuleSwitchboard catalogue={catalogue.data} value={modules} onChange={setModules} disabled={busy} />
            )}
          </Card>
          <FormActions error={busy ? "Creating the school's databases… this can take a minute." : form.formError}>
            <ButtonLink to="/platform">Cancel</ButtonLink>
            <Button type="submit" variant="primary" loading={busy} disabled={modules === null}>
              Onboard school
            </Button>
          </FormActions>
        </div>
      </form>
    </Page>
  );
}

type CodeState = "idle" | "checking" | "available" | "taken" | "invalid";

/* Is the code free? Asked once the typing stops */
function useCodeCheck(raw: string) {
  const code = useDebounce(raw.trim().toUpperCase(), 350);
  const [result, setResult] = useState<{ code: string; available: boolean } | null>(null);
  const valid = CODE.test(code);
  useEffect(() => {
    if (!valid) return;
    let live = true;
    checkCode(code)
      .then(r => live && setResult(r))
      .catch(() => live && setResult(null));
    return () => {
      live = false;
    };
  }, [code, valid]);
  const current = raw.trim().toUpperCase();
  let state: CodeState = "idle";
  if (!current) state = "idle";
  else if (!CODE.test(current)) state = "invalid";
  else if (result?.code !== current) state = "checking";
  else state = result.available ? "available" : "taken";
  return { state };
}

function CodeHint({ state, code }: { state: CodeState; code: string }) {
  if (state === "available")
    return (
      <span className="inline-icon code-ok">
        <CheckCircle2 size={13} /> {code} is available
      </span>
    );
  if (state === "taken")
    return (
      <span className="inline-icon code-taken">
        <CircleAlert size={13} /> {code} is already taken
      </span>
    );
  if (state === "invalid") return <>2-20 letters, digits or dashes</>;
  if (state === "checking") return <>Checking…</>;
  return <>Staff use it on links; it can't be changed later.</>;
}

/* After onboarding: the invitation, and where to go next */
function Onboarded({ school, invitation, email, onAnother }: { school: SchoolDetail; invitation: Invitation; email: string; onAnother: () => void }) {
  const navigate = useNavigate();
  const addOns = school.moduleStates.filter(m => !m.core && m.enabled);
  return (
    <Page>
      <PageHeader title={`${school.name} is ready`} subtitle={<span className="mono">{school.code}</span>} breadcrumbs={[{ label: "Schools", to: "/platform" }, { label: school.name }]} />
      <div className="stack" style={{ maxWidth: 760 }}>
        <Card title="Administrator invitation">
          <InvitationPanel invitation={invitation} email={email} />
        </Card>
        <Card title="Modules switched on">
          <p className="muted">{addOns.length ? addOns.map(m => m.label).join(", ") : "Core modules only"}, plus the core modules.</p>
        </Card>
        <div className="row">
          <Button variant="primary" onClick={() => navigate(`/platform/schools/${school.id}`)}>
            Open the school
          </Button>
          <Button onClick={onAnother}>Onboard another school</Button>
        </div>
      </div>
    </Page>
  );
}
