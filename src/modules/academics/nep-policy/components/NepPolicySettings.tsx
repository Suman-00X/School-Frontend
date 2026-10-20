import { useState } from "react";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { Alert, Button, Card, Checkbox, ErrorState, SkeletonBlock, Switch, TextInput, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import "../../holistic-progress/holistic.css";
import { NEP_POLICY_PATH, updateNepPolicy, type NepPolicy, type NepPolicyChanges, type NepStage } from "../api/nepPolicy";

type Draft = Required<Pick<NepPolicy, "holisticProgressCard" | "hpcStages" | "udiseExport" | "apaarExport">> & { udiseCode: string };

const draftOf = (p: NepPolicy): Draft => ({
  holisticProgressCard: p.holisticProgressCard,
  hpcStages: p.hpcStages,
  udiseExport: p.udiseExport,
  apaarExport: p.apaarExport,
  udiseCode: p.udiseCode ?? ""
});

/* Setup › Policy › NEP 2020: what the school opts into. Opted-in features show up in
   Exams & results (Holistic progress, UDISE+ / APAAR tabs); nothing shows while they are off. */
export function NepPolicySettings() {
  const policy = useApiGet<NepPolicy>(NEP_POLICY_PATH);
  if (policy.error) return <ErrorState error={policy.error} onRetry={() => void policy.refetch()} />;
  if (!policy.data) return <SkeletonBlock lines={8} />;
  /* A fresh form for each saved version */
  return <NepPolicyForm key={policy.data.updatedAt} policy={policy.data} />;
}

function NepPolicyForm({ policy }: { policy: NepPolicy }) {
  const { can } = useAuth();
  const toast = useToast();
  const canManage = can("academics.nepPolicy.manage");
  const save = useApiMutation(updateNepPolicy, { invalidate: [NEP_POLICY_PATH, "/academics/holistic-progress", "/reports/government-exports"] });
  const [draft, setDraft] = useState<Draft>(() => draftOf(policy));

  const set = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }));
  const toggleStage = (stage: NepStage, on: boolean) =>
    set({ hpcStages: on ? [...draft.hpcStages, stage] : draft.hpcStages.filter(s => s !== stage) });

  const code = draft.udiseCode.trim();
  const codeError = code && !/^\d{11}$/.test(code) ? "The UDISE code has 11 digits" : draft.udiseExport && !code ? "Needed for the UDISE+ export" : null;
  const stageError = draft.holisticProgressCard && !draft.hpcStages.length ? "Pick at least one stage" : null;

  const saved = draftOf(policy);
  const changes: NepPolicyChanges = {};
  if (draft.holisticProgressCard !== saved.holisticProgressCard) changes.holisticProgressCard = draft.holisticProgressCard;
  if ([...draft.hpcStages].sort().join() !== [...saved.hpcStages].sort().join()) changes.hpcStages = draft.hpcStages;
  if (draft.udiseExport !== saved.udiseExport) changes.udiseExport = draft.udiseExport;
  if (draft.apaarExport !== saved.apaarExport) changes.apaarExport = draft.apaarExport;
  if (code !== saved.udiseCode) changes.udiseCode = code || null;
  const dirty = Object.keys(changes).length > 0;

  const submit = () =>
    save.mutate(changes, {
      onSuccess: res => toast.success(res.message),
      onError: err => toast.error(err)
    });

  const disabled = !canManage || save.isPending;

  return (
    <div className="stack">
      {!canManage && <Alert>Only an administrator or the principal can change these.</Alert>}
      <Card
        title="Holistic Progress Card"
        subtitle="The NEP 2020 report card designed by PARAKH (NCERT). Teachers fill it in per exam, under Exams & results › Report cards."
      >
        <div className="stack">
          <Switch
            label={draft.holisticProgressCard ? "The school uses the Holistic Progress Card" : "Not used"}
            checked={draft.holisticProgressCard}
            disabled={disabled}
            onChange={on => set({ holisticProgressCard: on })}
          />
          <div className="field">
            <span className="field-label">For these stages</span>
            <div className="nep-stages">
              {policy.stages.map(s => (
                <Checkbox
                  key={s.stage}
                  label={
                    <span>
                      {s.label} <span className="muted small">· {s.classes}</span>
                    </span>
                  }
                  checked={draft.hpcStages.includes(s.stage)}
                  disabled={disabled || !draft.holisticProgressCard}
                  onChange={e => toggleStage(s.stage, e.target.checked)}
                />
              ))}
            </div>
            <div className={`field-message${stageError ? " field-error" : " field-hint"}`}>
              {stageError ?? "Classes in other stages keep the usual report card only. A class without a grade level has no stage."}
            </div>
          </div>
        </div>
      </Card>

      <Card title="UDISE+ and APAAR" subtitle="Student files for the government portals, downloaded from Exams & results › Report cards.">
        <div className="stack">
          <TextInput
            label="School UDISE code"
            inputMode="numeric"
            maxLength={11}
            placeholder="11 digits"
            value={draft.udiseCode}
            error={codeError}
            hint="Printed on the files and the Holistic Progress Card"
            disabled={disabled}
            onChange={e => set({ udiseCode: e.target.value.replace(/\D/g, "") })}
            fieldClassName="nep-code"
          />
          <Switch
            label="UDISE+ student profile export"
            checked={draft.udiseExport}
            disabled={disabled}
            onChange={on => set({ udiseExport: on })}
          />
          <Switch
            label="APAAR id export (generation and verification lists)"
            checked={draft.apaarExport}
            disabled={disabled}
            onChange={on => set({ apaarExport: on })}
          />
          <p className="muted small" style={{ margin: 0 }}>
            Students' PEN, APAAR id and the parents' APAAR consent date are entered on each student's profile.
          </p>
        </div>
      </Card>

      {canManage && (
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="muted small">Last changed {formatDateTime(policy.updatedAt)}</span>
          <div className="row">
            <Button disabled={!dirty || save.isPending} onClick={() => setDraft(saved)}>
              Discard
            </Button>
            <Button variant="primary" disabled={!dirty || !!codeError || !!stageError} loading={save.isPending} onClick={submit}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
