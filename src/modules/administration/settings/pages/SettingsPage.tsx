import { useEffect, useMemo, useRef, type FormEvent } from "react";
import { useAuth } from "@/common/auth";
import { changedFields, useForm } from "@/common/hooks";
import { Alert, Button, Card, ErrorState, Page, PageHeader, Select, SkeletonBlock, TextInput, Textarea, useToast } from "@/common/ui";
import { relativeTime } from "@/common/utils/format";
import { useSettings, useUpdateSettings, type SchoolSettings, type SettingsChanges } from "../api/settings";
import { LogoCard } from "../components/LogoCard";
import { countryOptions, currencyOptions, timeZones } from "../utils/regions";
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

/* AD-01 */
export default function SettingsPage() {
  const { can } = useAuth();
  const canEdit = can("administration.settings.update");
  const settings = useSettings();

  return (
    <Page>
      <PageHeader
        title="School settings"
        subtitle={settings.data ? `Last updated ${relativeTime(settings.data.updatedAt)}` : "The school's profile, region and logo"}
      />
      {settings.error ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : !settings.data ? (
        <div className="settings-layout">
          <Card title="School">
            <SkeletonBlock lines={6} />
          </Card>
          <Card title="Logo">
            <SkeletonBlock lines={3} />
          </Card>
        </div>
      ) : (
        <div className="settings-layout">
          <SettingsForm settings={settings.data} canEdit={canEdit} />
          <div>
            <LogoCard settings={settings.data} canEdit={canEdit} onExpired={() => void settings.refetch()} />
          </div>
        </div>
      )}
    </Page>
  );
}

function SettingsForm({ settings, canEdit }: { settings: SchoolSettings; canEdit: boolean }) {
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
  const zones = timeZones();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    const errors: Record<string, string> = {};
    if (!values.name.trim()) errors.name = "is required";
    /* The API takes no empty email or phone: once set they can be changed, not removed */
    if ("contactEmail" in changes && !values.contactEmail.trim()) errors.contactEmail = "can be changed but not removed";
    if ("contactPhone" in changes && !values.contactPhone.trim()) errors.contactPhone = "can be changed but not removed";
    if (values.timezone && !zones.includes(values.timezone) && values.timezone !== settings.timezone)
      errors.timezone = "pick a time zone from the list, such as Asia/Kolkata";
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

  const field = (key: keyof Values) => ({ ...form.text(key), disabled: !canEdit || update.isPending });

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {!canEdit && <Alert tone="info">Only an administrator can change the school's settings.</Alert>}
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
          <TextInput
            label="Time zone"
            list="settings-time-zones"
            autoComplete="off"
            hint="Changes what 'today' means for attendance, fees and due dates."
            {...field("timezone")}
          />
          <datalist id="settings-time-zones">
            {zones.map(z => (
              <option key={z} value={z} />
            ))}
          </datalist>
          <Select label="Currency" options={currencyOptions(values.currency)} {...field("currency")} />
          <Select label="Country" options={countryOptions(values.country)} {...field("country")} />
        </div>
      </Card>
      {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      {canEdit && (
        <div className="form-actions">
          <Button onClick={() => form.reset(original)} disabled={!dirty || update.isPending}>
            Discard changes
          </Button>
          <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      )}
    </form>
  );
}
