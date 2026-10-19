/* FI-06 · Finance and payment settings: refund approval limit, and the school's Razorpay keys (BYOK) */
import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiMutation } from "@/common/hooks";
import { Button, Card, ErrorState, FormActions, PageHeader, SkeletonBlock, useToast } from "@/common/ui";
import { relativeTime } from "@/common/utils/format";
import { PaymentSettingsCard } from "../../payment-settings";
import { formatAmount, hasTooManyDecimals, MoneyInput, parseAmount, UserName, useMoney } from "../../shared";
import { FINANCE_SETTINGS_PATH, updateFinanceSettings, useFinanceSettings, type FinanceSettings } from "../api/financeSettings";
import "../../payment-settings/components/paymentSettings.css";

export default function FinanceSettingsPage() {
  const { can } = useAuth();
  return (
    <div className="stack">
      <PageHeader title="Settings" subtitle="Who approves refunds, and how families pay online. Invoice, receipt and refund numbers are set by the system." />
      <div className="finance-settings">
        {can("finance.settings.read") && <RefundApprovalCard />}
        {can("finance.paymentSettings.read") && <PaymentSettingsCard />}
      </div>
    </div>
  );
}

const HELP = "An accountant's refund up to this amount is approved at once. 0: every refund needs an administrator.";

function RefundApprovalCard() {
  const { can } = useAuth();
  const settings = useFinanceSettings();
  const canEdit = can("finance.settings.manage");
  return (
    <Card title="Refund approval" subtitle={settings.data?.updatedAt ? <LastChanged s={settings.data} /> : "Administrators' own refunds never need approval"}>
      {settings.error ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : !settings.data ? (
        <SkeletonBlock lines={3} />
      ) : (
        <LimitForm settings={settings.data} canEdit={canEdit} />
      )}
    </Card>
  );
}

function LastChanged({ s }: { s: FinanceSettings }) {
  return (
    <>
      Last changed {relativeTime(s.updatedAt)} by <UserName id={s.updatedBy} />
    </>
  );
}

function LimitForm({ settings, canEdit }: { settings: FinanceSettings; canEdit: boolean }) {
  const toast = useToast();
  const money = useMoney();
  const [text, setText] = useState(String(settings.refundApprovalLimit));
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const update = useApiMutation(updateFinanceSettings, { invalidate: [FINANCE_SETTINGS_PATH] });

  useEffect(() => setText(String(settings.refundApprovalLimit)), [settings.refundApprovalLimit]);

  const value = parseAmount(text);
  const dirty = value !== settings.refundApprovalLimit;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (value === null || value < 0) return setError("0 or more");
    if (hasTooManyDecimals(text)) return setError("At most 2 decimals");
    if (value > 100_000_000) return setError("At most 100,000,000");
    setError(null);
    update.mutate(
      { refundApprovalLimit: value },
      { onSuccess: res => toast.success(res.message), onError: err => setFormError(errorMessage(err)) }
    );
  };

  if (!canEdit)
    return (
      <div className="stack-sm">
        <div style={{ fontSize: 20, fontWeight: 600 }} className="amount">
          {settings.refundApprovalLimit > 0 ? money(settings.refundApprovalLimit) : "Every refund needs an administrator"}
        </div>
        <p className="small muted">{HELP} Only an administrator can change it.</p>
      </div>
    );

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="form-grid">
        <MoneyInput
          label="Approved at once up to"
          value={text}
          onChange={e => {
            setText(e.target.value.replace(/[^\d.,]/g, ""));
            setError(null);
          }}
          error={error}
          hint={value ? `Refunds above ${formatAmount(value)} wait for an administrator` : "Every accountant's refund waits for an administrator"}
        />
      </div>
      <p className="small muted">{HELP} It applies per payment, or per student's credit.</p>
      <FormActions error={formError}>
        <Button onClick={() => setText(String(settings.refundApprovalLimit))} disabled={!dirty || update.isPending}>
          Discard
        </Button>
        <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty}>
          Save
        </Button>
      </FormActions>
    </form>
  );
}
