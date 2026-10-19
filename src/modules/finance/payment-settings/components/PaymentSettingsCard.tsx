import { useState, type FormEvent } from "react";
import { Check, Copy, KeyRound, PlugZap, Trash2 } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiMutation, useForm } from "@/common/hooks";
import { Alert, Badge, Button, Card, DescriptionList, Dialog, ErrorState, FormActions, PasswordInput, SkeletonBlock, TextInput, useConfirm, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { UserName } from "../../shared";
import { KEY_ID, PAYMENT_SETTINGS_PATH, removeKeys, saveKeys, testConnection, usePaymentSettings, type KeysInput } from "../api/paymentSettings";
import "./paymentSettings.css";

const EMPTY: KeysInput = { keyId: "", keySecret: "", webhookSecret: "" };

const secretProblem = (v: string) => (v.length < 8 ? "At least 8 characters" : /\s/.test(v) ? "No spaces" : null);

/* "****f9Qa" → "Set · ends in f9Qa" (the API never returns a secret) */
const secretState = (masked: string | null | undefined) => (masked ? `Set · ends in ${masked.replace(/^\*+/, "")}` : "Not set");

/* FI-06 "Online payments": the school's Razorpay keys (administrators only) */
export function PaymentSettingsCard() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = can("finance.paymentSettings.manage");
  const settings = usePaymentSettings(can("finance.paymentSettings.read"));
  const [replacing, setReplacing] = useState(false);
  const test = useApiMutation(testConnection, { invalidate: [PAYMENT_SETTINGS_PATH] });
  const remove = useApiMutation(removeKeys, { invalidate: [PAYMENT_SETTINGS_PATH] });
  const s = settings.data;

  const askRemove = async () => {
    const ok = await confirm({
      title: "Remove the Razorpay keys?",
      message: "Online payments will stop. Payments already recorded are not affected. You can add keys again later.",
      confirmLabel: "Remove keys"
    });
    if (ok) remove.mutate(undefined, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  /* The 422 message is meant for people ("Razorpay rejected these keys (HTTP 401)…") */
  const runTest = () => test.mutate(undefined, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });

  return (
    <Card
      title="Online payments"
      subtitle="Families pay online through the school's own Razorpay account"
      actions={s?.configured && <Badge tone={s.mode === "live" ? "success" : "warning"}>{s.mode === "live" ? "Live" : "Test"}</Badge>}
    >
      {settings.error ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : !s ? (
        <SkeletonBlock lines={6} />
      ) : (
        <div className="stack">
          {s.simulated && <Alert tone="info">Payments are simulated (mock gateway). No real money moves on this server.</Alert>}
          {s.configured ? (
            <>
              <DescriptionList
                items={[
                  { label: "Key id", value: <span className="mono">{s.keyId}</span> },
                  {
                    label: "Connection",
                    value: s.verifiedAt ? (
                      <span className="row" style={{ gap: 6 }}>
                        <Check size={14} style={{ color: "var(--success-text)" }} /> Verified on {formatDateTime(s.verifiedAt)}
                      </span>
                    ) : (
                      <span className="muted">Not verified yet</span>
                    )
                  },
                  { label: "Key secret", value: secretState(s.keySecret) },
                  { label: "Webhook secret", value: secretState(s.webhookSecret) },
                  { label: "Saved by", value: <UserName id={s.configuredBy} /> },
                  { label: "Last changed", value: formatDateTime(s.updatedAt) }
                ]}
              />
              <WebhookUrl url={s.webhookUrl} />
              {canManage && (
                <div className="row">
                  <Button icon={<KeyRound />} onClick={() => setReplacing(true)}>
                    Replace keys
                  </Button>
                  <Button icon={<PlugZap />} onClick={runTest} loading={test.isPending}>
                    Test connection
                  </Button>
                  <Button icon={<Trash2 />} variant="ghost" onClick={() => void askRemove()} loading={remove.isPending}>
                    Remove
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="muted">
                Online payments are off. Add the key id, key secret and webhook secret from the school's Razorpay dashboard (Settings › API keys and Webhooks). Counter payments work either way.
              </p>
              <WebhookUrl url={s.webhookUrl} />
              {canManage && <KeysForm onSaved={() => undefined} />}
            </>
          )}
        </div>
      )}
      {s && (
        <Dialog open={replacing} onClose={() => setReplacing(false)} title="Replace Razorpay keys">
          <p className="small muted" style={{ marginBottom: 14 }}>
            The three go together. The new keys need a connection test before you rely on them.
          </p>
          <KeysForm onSaved={() => setReplacing(false)} inDialog onCancel={() => setReplacing(false)} />
        </Dialog>
      )}
    </Card>
  );
}

/* Key id, key secret and webhook secret: always all three, secrets never prefilled */
function KeysForm({ onSaved, inDialog, onCancel }: { onSaved: () => void; inDialog?: boolean; onCancel?: () => void }) {
  const toast = useToast();
  const form = useForm<KeysInput>(EMPTY);
  const save = useApiMutation(saveKeys, { invalidate: [PAYMENT_SETTINGS_PATH] });
  const { values } = form;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    const keyId = values.keyId.trim();
    if (!KEY_ID.test(keyId)) errors.keyId = "Starts with rzp_test_ or rzp_live_";
    const ks = secretProblem(values.keySecret.trim());
    const ws = secretProblem(values.webhookSecret.trim());
    if (ks) errors.keySecret = ks;
    if (ws) errors.webhookSecret = ws;
    form.setErrors(errors);
    form.setFormError(null);
    if (Object.keys(errors).length) return;
    save.mutate(
      { keyId, keySecret: values.keySecret.trim(), webhookSecret: values.webhookSecret.trim() },
      {
        onSuccess: res => {
          toast.success(res.message);
          form.reset(EMPTY);
          onSaved();
        },
        onError: err => (isApiError(err) && err.isValidation ? form.setServerErrors(err) : form.setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again."))
      }
    );
  };

  return (
    <form className="stack" onSubmit={submit} noValidate autoComplete="off">
      <TextInput label="Key id" required placeholder="rzp_test_…" className="mono" hint="rzp_test_… for test mode, rzp_live_… for real payments" autoComplete="off" spellCheck={false} {...form.text("keyId")} />
      <div className="form-grid">
        <PasswordInput label="Key secret" required autoComplete="new-password" {...form.text("keySecret")} />
        <PasswordInput label="Webhook secret" required autoComplete="new-password" hint="The secret you set on the webhook" {...form.text("webhookSecret")} />
      </div>
      <FormActions error={form.formError}>
        {inDialog && <Button onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant="primary" loading={save.isPending}>
          {inDialog ? "Replace keys" : "Save keys"}
        </Button>
      </FormActions>
    </form>
  );
}

function WebhookUrl({ url }: { url: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the address and copy it by hand.");
    }
  };
  return (
    <div className="field">
      <span className="field-label">Webhook URL</span>
      <div className="webhook-url">
        <code title={url}>{url}</code>
        <Button size="sm" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()} aria-label="Copy the webhook URL">
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="field-message field-hint">Paste it into Razorpay › Webhooks, with the events payment.captured and refund.*</div>
    </div>
  );
}
