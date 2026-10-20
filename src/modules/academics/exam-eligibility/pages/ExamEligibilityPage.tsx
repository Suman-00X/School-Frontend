/* Exam eligibility policy (Academics › Setup › Policy): who may sit exams and get an admit card */
import { useEffect, useState, type FormEvent } from "react";
import { errorMessage, isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { Alert, Button, Card, ErrorState, FormActions, Page, PageHeader, Switch, TextInput, useToast } from "@/common/ui";
import { formatMoney, relativeTime } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import {
  EXAM_ELIGIBILITY_POLICY_PATH,
  rulesSentence,
  updateExamEligibilityPolicy,
  type ExamEligibilityPolicy,
  type ExamEligibilityPolicyChanges
} from "../api/examEligibility";
import "../../shared/components/setup.css";

type Values = { attendanceRuleEnabled: boolean; minAttendancePercentage: string; duesRuleEnabled: boolean; maxOverdueAmount: string };

const valuesOf = (p?: ExamEligibilityPolicy): Values => ({
  attendanceRuleEnabled: !!p?.attendanceRuleEnabled,
  minAttendancePercentage: p ? String(p.minAttendancePercentage) : "",
  duesRuleEnabled: !!p?.duesRuleEnabled,
  maxOverdueAmount: p ? String(p.maxOverdueAmount) : ""
});

/* Two rules, each switched on or off. Only ADMIN edits; everyone else sees them disabled. */
export default function ExamEligibilityPage() {
  const { can } = useAuth();
  const canEdit = can("academics.examEligibility.managePolicy");
  const policy = useApiGet<ExamEligibilityPolicy>(EXAM_ELIGIBILITY_POLICY_PATH);

  return (
    <Page>
      <PageHeader
        title="Exam eligibility"
        subtitle={
          (canEdit
            ? "Who may sit exams. Students who don't meet the rules get no admit card."
            : "Who may sit exams. Only an administrator can change this.") + (policy.data ? ` · updated ${relativeTime(policy.data.updatedAt)}` : "")
        }
      />
      {policy.error ? <ErrorState error={policy.error} onRetry={() => void policy.refetch()} /> : <RulesForm policy={policy.data} canEdit={canEdit} />}
    </Page>
  );
}

function RulesForm({ policy, canEdit }: { policy?: ExamEligibilityPolicy; canEdit: boolean }) {
  const toast = useToast();
  const currency = useSchoolCurrency();
  const money = (n: number) => formatMoney(n, currency);
  const save = useApiMutation(updateExamEligibilityPolicy, { invalidate: [EXAM_ELIGIBILITY_POLICY_PATH, "/academics/exams"] });
  const [values, setValues] = useState<Values>(() => valuesOf(policy));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const original = valuesOf(policy);

  /* New data (a save, a refetch): adopt it unless there are unsaved edits */
  const key = policy ? `${policy.id}:${policy.updatedAt}` : "";
  const [seen, setSeen] = useState(key);
  useEffect(() => {
    if (key !== seen) {
      setValues(valuesOf(policy));
      setSeen(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const changes: ExamEligibilityPolicyChanges = {};
  if (policy) {
    if (values.attendanceRuleEnabled !== original.attendanceRuleEnabled) changes.attendanceRuleEnabled = values.attendanceRuleEnabled;
    if (values.minAttendancePercentage !== original.minAttendancePercentage) changes.minAttendancePercentage = Number(values.minAttendancePercentage);
    if (values.duesRuleEnabled !== original.duesRuleEnabled) changes.duesRuleEnabled = values.duesRuleEnabled;
    if (values.maxOverdueAmount !== original.maxOverdueAmount) changes.maxOverdueAmount = Number(values.maxOverdueAmount);
  }
  const dirty = Object.keys(changes).length > 0;
  const disabled = !canEdit || !policy || save.isPending;

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    setValues(x => ({ ...x, [k]: v }));
    setErrors(({ [k]: _drop, ...rest }) => rest);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const pct = Number(values.minAttendancePercentage);
    if (values.minAttendancePercentage.trim() === "" || !Number.isInteger(pct) || pct < 1 || pct > 100) errs.minAttendancePercentage = "A whole number from 1 to 100";
    const amount = Number(values.maxOverdueAmount);
    if (values.maxOverdueAmount.trim() === "" || !Number.isFinite(amount) || amount < 0 || !/^\d+(\.\d{1,2})?$/.test(values.maxOverdueAmount.trim()))
      errs.maxOverdueAmount = "An amount of 0 or more, with at most 2 decimals";
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setFormError(null);
    save.mutate(changes, {
      onSuccess: res => toast.success(res.message),
      onError: err => {
        if (isApiError(err) && err.isValidation) setErrors(err.fieldErrors());
        setFormError(errorMessage(err));
      }
    });
  };

  const preview = {
    attendanceRuleEnabled: values.attendanceRuleEnabled,
    minAttendancePercentage: Number(values.minAttendancePercentage) || 0,
    duesRuleEnabled: values.duesRuleEnabled,
    maxOverdueAmount: Number(values.maxOverdueAmount) || 0
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="policy-layout">
        <Card title="Attendance" subtitle="Counted from the start of the year up to the day before the exam starts">
          <div className="stack">
            <Switch label="Require a minimum attendance" checked={values.attendanceRuleEnabled} disabled={disabled} onChange={v => set("attendanceRuleEnabled", v)} />
            <TextInput
              label="Minimum attendance (%)"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={values.minAttendancePercentage}
              disabled={disabled || !values.attendanceRuleEnabled}
              hint="Days not marked count as absent"
              error={errors.minAttendancePercentage}
              fieldClassName="policy-date"
              onChange={e => set("minAttendancePercentage", e.target.value)}
            />
          </div>
        </Card>
        <Card title="Fee dues" subtitle="Fees past their due date and still unpaid on the day admit cards are generated">
          <div className="stack">
            <Switch label="Block students with overdue fees" checked={values.duesRuleEnabled} disabled={disabled} onChange={v => set("duesRuleEnabled", v)} />
            <TextInput
              label={`Overdue amount allowed (${currency})`}
              inputMode="decimal"
              value={values.maxOverdueAmount}
              disabled={disabled || !values.duesRuleEnabled}
              hint={Number(values.maxOverdueAmount) > 0 ? `Students owing more than ${money(Number(values.maxOverdueAmount))} past due are blocked` : "0: every fee that is due must be paid"}
              error={errors.maxOverdueAmount}
              fieldClassName="policy-date"
              onChange={e => set("maxOverdueAmount", e.target.value)}
            />
          </div>
        </Card>
      </div>
      <Alert tone="info">
        {rulesSentence(preview, money)} Students who don't meet the rules get no admit card. A principal can still allow one student to sit an exam, giving a reason, from the
        exam's Admit cards tab.
      </Alert>
      {canEdit && (
        <FormActions error={formError}>
          <Button type="button" disabled={!dirty || save.isPending} onClick={() => setValues(original)}>
            Discard
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty}>
            Save rules
          </Button>
        </FormActions>
      )}
    </form>
  );
}
