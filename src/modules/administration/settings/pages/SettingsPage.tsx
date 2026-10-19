import { useEffect, useMemo, useRef, type FormEvent } from "react";
import { useAuth } from "@/common/auth";
import { changedFields, useForm } from "@/common/hooks";
import { Alert, Button, Card, ErrorState, FormActions, Page, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { relativeTime } from "@/common/utils/format";
import { useSettings, useUpdateSettings, type SchoolSettings, type SettingsChanges } from "../api/settings";
import { LogoCard } from "../components/LogoCard";
import { PageIntro } from "../../shared/components/PageIntro";
import { countryOptions, currencyOptions, timeZoneOptions } from "../utils/regions";
import "../settings.css";

type Values = {
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
  timezone: string;
  currency: string;
  country: string;
};

const toValues = (s: SchoolSettings): Values => ({
  name: s.name ?? "",
  address: s.address ?? "",
  contactEmail: s.contactEmail ?? "",
  contactPhone: s.contactPhone ?? "",
  description: s.description ?? "",
  timezone: s.timezone ?? "",
  currency: s.currency ?? "",
  country: s.country ?? ""
});

/* Shown (disabled, empty) until the settings arrive: the same form, so nothing moves when they do */
const LOADING: SchoolSettings = {
  id: "",
  name: "",
  code: "",
  address: null,
  contactEmail: null,
  contactPhone: null,
  description: null,
  timezone: "",
  currency: "",
  country: "",
  updatedAt: "",
  logoUrl: null
};

/* AD-01. One page, one Save: the school's profile and region on the left, the logo (its own
   upload) on the right. Three short cards read better side by side than as side-nav sections. */
export default function SettingsPage() {
  const { can } = useAuth();
  const canEdit = can("administration.settings.update");
  const settings = useSettings();
  const loading = !settings.data;

  return (
    <Page>
      {/* The header tab already says "School settings": no title */}
      <PageIntro>
        {settings.data ? `The school's profile, region and logo · last updated ${relativeTime(settings.data.updatedAt)}` : "The school's profile, region and logo"}
      </PageIntro>
      {!canEdit && <Alert tone="info">Only an administrator can change the school's settings.</Alert>}
      {settings.error ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <div className="settings-layout">
          <SettingsForm settings={settings.data ?? LOADING} canEdit={canEdit} loading={loading} />
          <div>
            <LogoCard settings={settings.data ?? LOADING} canEdit={canEdit} loading={loading} onExpired={() => void settings.refetch()} />
          </div>
        </div>
      )}
    </Page>
  );
}

function SettingsForm({ settings, canEdit, loading }: { settings: SchoolSettings; canEdit: boolean; loading: boolean }) {
  const toast = useToast();
  const update = useUpdateSettings();
  const original = useMemo(() => toValues(settings), [settings]);
  const form = useForm<Values>(original);
  const { values } = form;

  /* New settings (a save, a logo upload, a re-fetch): adopt them unless there are unsaved edits */
  const previous = useRef(original);
  useEffect(() => {
    if (Object.keys(changedFields(previous.current, form.values)).length === 0) form.reset(original);
    previous.current = original;
  }, [original]); // eslint-disable-line react-hooks/exhaustive-deps

  const changes = changedFields(original, values);
  const dirty = Object.keys(changes).length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    const errors: Record<string, string> = {};
    if (!values.name.trim()) errors.name = "is required";
    /* The API takes no empty email or phone: once set they can be changed, not removed */
    if ("contactEmail" in changes && !values.contactEmail.trim()) errors.contactEmail = "can be changed but not removed";
    if ("contactPhone" in changes && !values.contactPhone.trim()) errors.contactPhone = "can be changed but not removed";
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      form.setFormError("Please correct the highlighted fields.");
      return;
    }
    form.setFormError(null);
    /* changedFields turns a cleared field into null; the API wants "" for the free-text ones */
    const body = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v ?? ""])) as SettingsChanges;
    update.mutate(body, {
      onSuccess: res => toast.success(res.message),
      onError: err => form.setServerErrors(err)
    });
  };

  const field = (key: keyof Values) => ({ ...form.text(key), disabled: !canEdit || loading || update.isPending });

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <Card title="School" subtitle="How the school appears on documents and messages">
        <div className="form-grid">
          <TextInput label="School name" required maxLength={150} {...field("name")} />
          <TextInput label="School code" value={settings.code} disabled readOnly hint="Used at sign-in. It can't be changed." />
          <TextInput label="Contact email" type="email" maxLength={254} {...field("contactEmail")} />
          <TextInput label="Contact phone" type="tel" placeholder="+91 98765 43210" {...field("contactPhone")} />
          <Textarea label="Address" rows={2} maxLength={500} fieldClassName="span-2" {...field("address")} />
          <Textarea label="Description" rows={3} maxLength={1000} fieldClassName="span-2" {...field("description")} />
        </div>
      </Card>
      <Card title="Region" subtitle="Dates and money across the app follow these">
        <div className="form-grid">
          <Select
            label="Time zone"
            placeholder={values.timezone ? undefined : "Not set"}
            options={timeZoneOptions(values.timezone)}
            hint="Changes what 'today' means for attendance, fees and due dates."
            {...field("timezone")}
          />
          <Select label="Currency" options={currencyOptions(values.currency)} {...field("currency")} />
          <Select label="Country" options={countryOptions(values.country)} {...field("country")} />
        </div>
      </Card>
      {canEdit && (
        <FormActions error={form.formError}>
          <Button onClick={() => form.reset(original)} disabled={!dirty || update.isPending}>
            Discard changes
          </Button>
          <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty}>
            Save changes
          </Button>
        </FormActions>
      )}
    </form>
  );
}
