import { useState } from "react";
import { CalendarSync } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { ButtonLink, Button, Card, DataTable, EmptyState, Field, FormActions, Page, Select, Stepper, Switch, useToast, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { isApiError } from "@/common/api";
import { runRollover, type RolloverEntry, type RolloverResult } from "../api/allocations";

const STEPS = ["Target year", "Preview", "Done"];

type Skipped = RolloverEntry & { reason: string };
type ResourceRow = { assignmentId: string; resource: { name: string } | null; student: RolloverEntry["student"]; reason?: string };

const continuedColumns: Column<RolloverEntry>[] = [
  { key: "student", header: "Student", render: r => <strong>{r.student.name}</strong> },
  { key: "code", header: "Code", render: r => <span className="mono small">{r.student.studentCode}</span> },
  { key: "bed", header: "Bed", render: r => r.bed ?? <span className="muted">—</span> }
];
const skippedColumns: Column<Skipped>[] = [...(continuedColumns as Column<Skipped>[]), { key: "reason", header: "Why not", render: r => r.reason }];
const resourceColumns = (withReason: boolean): Column<ResourceRow>[] => [
  { key: "student", header: "Student", render: r => r.student.name },
  { key: "resource", header: "Resource", render: r => r.resource?.name ?? <span className="muted">Removed</span> },
  ...(withReason ? [{ key: "reason", header: "Why not", render: (r: ResourceRow) => r.reason }] : [])
];

/* HO-02 · Year-end roll-over: residents whose bed runs to the last day of the selected year keep
   the same bed for the whole target year. Preview (dry run) first, then run. */
export default function RolloverPage() {
  const toast = useToast();
  const { selected: source, years } = useAcademicYear();
  const [step, setStep] = useState(0);
  const [targetId, setTargetId] = useState("");
  const [includeResources, setIncludeResources] = useState(true);
  const [preview, setPreview] = useState<RolloverResult | null>(null);
  const [result, setResult] = useState<RolloverResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useApiMutation(runRollover, { invalidate: ["/hostel"] });

  const targets = years.filter(y => source && y.startDate > source.endDate && !y.archivedAt).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const header = <DrillHeader back="/hostel/allocations" backLabel="Back to bed allocations" title="Year-end roll-over" />;

  const go = (dryRun: boolean) => {
    setError(null);
    run.mutate(
      { toAcademicYearId: targetId, includeResources, dryRun },
      {
        onSuccess: res => {
          if (dryRun) {
            setPreview(res.data);
            setStep(1);
          } else {
            setResult(res.data);
            setStep(2);
            toast.success(res.message);
          }
        },
        onError: e => setError(isApiError(e) ? e.message : "Something went wrong. Please try again.")
      }
    );
  };

  const shown = step === 2 ? result : preview;

  return (
    <Page>
      {header}
      <Stepper steps={STEPS} current={step} onStepClick={i => step < 2 && setStep(i)} />

      {step === 0 && (
        <Card title={`From ${source?.yearName ?? "the selected year"}`} subtitle="Residents come from the year chosen in the header. Pick the year they continue into.">
          {!targets.length ? (
            <EmptyState
              icon={<CalendarSync />}
              title="No year to roll over into"
              message={`Create the academic year after ${source?.yearName ?? "this one"} first (Academics › Academic years).`}
            />
          ) : (
            <div className="stack">
              <Select
                label="Continue into"
                required
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                options={targets.map(y => ({ value: y.id, label: y.yearName, description: `${formatDate(y.startDate)} – ${formatDate(y.endDate)}` }))}
                placeholder="Pick the next year"
                hint="Must start after the current year ends"
              />
              <Field hint="Lockers, cupboards and plans that run to the year's last day continue with the bed">
                <Switch label="Also continue their lockers and plans" checked={includeResources} onChange={setIncludeResources} />
              </Field>
            </div>
          )}
        </Card>
      )}

      {step > 0 && shown && (
        <>
          <Card
            title={step === 2 ? "Rolled over" : "Preview"}
            subtitle={`${shown.fromAcademicYear.yearName} → ${shown.toAcademicYear.yearName} (${formatDate(shown.toAcademicYear.startDate)} – ${formatDate(shown.toAcademicYear.endDate)})${step === 1 ? ". Nothing has changed yet." : ""}`}
          >
            <p>
              {shown.continued.length} resident{shown.continued.length === 1 ? "" : "s"} {step === 2 ? "kept" : "will keep"} their bed; {shown.skipped.length} {step === 2 ? "were" : "will be"} skipped.
            </p>
          </Card>
          <Card flush title={`${step === 2 ? "Continued" : "Will continue"} (${shown.continued.length})`}>
            <DataTable columns={continuedColumns} rows={shown.continued} rowKey={r => r.allocationId} empty={<EmptyState title="Nobody continues" />} />
          </Card>
          <Card flush title={`Skipped (${shown.skipped.length})`} subtitle="Left the school, open-ended stays, beds booked by someone else, or the gender rule">
            <DataTable columns={skippedColumns} rows={shown.skipped} rowKey={r => r.allocationId} empty={<EmptyState title="Nobody is skipped" />} />
          </Card>
          {shown.resources && (
            <div className="grid-2">
              <Card flush title={`Resources ${step === 2 ? "continued" : "to continue"} (${shown.resources.continued.length})`}>
                <DataTable columns={resourceColumns(false)} rows={shown.resources.continued} rowKey={r => r.assignmentId} empty={<EmptyState title="None" />} />
              </Card>
              <Card flush title={`Resources skipped (${shown.resources.skipped.length})`}>
                <DataTable columns={resourceColumns(true)} rows={shown.resources.skipped} rowKey={r => r.assignmentId} empty={<EmptyState title="None" />} />
              </Card>
            </div>
          )}
        </>
      )}

      <FormActions error={error}>
        {step === 0 && (
          <Button variant="primary" disabled={!targetId} loading={run.isPending} onClick={() => go(true)}>
            Preview
          </Button>
        )}
        {step === 1 && (
          <>
            <Button onClick={() => setStep(0)}>Back</Button>
            <Button variant="primary" loading={run.isPending} disabled={!preview?.continued.length} onClick={() => go(false)}>
              Roll over {preview?.continued.length ?? 0} resident{preview?.continued.length === 1 ? "" : "s"}
            </Button>
          </>
        )}
        {step === 2 && (
          <ButtonLink variant="primary" to="/hostel/allocations?view=list&phase=UPCOMING">
            See the new allocations
          </ButtonLink>
        )}
      </FormActions>
    </Page>
  );
}
