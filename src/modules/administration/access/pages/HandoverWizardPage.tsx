import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Repeat } from "lucide-react";
import { useAuth } from "@/common/auth";
import { DrillHeader } from "@/common/layout/ShellHeader";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  EmptyState,
  FooterStatus,
  Page,
  PersonCell,
  RoleBadge,
  Select,
  SkeletonBlock,
  Stepper,
  Textarea
} from "@/common/ui";
import { errorMessage } from "@/common/api";
import { formatDate } from "@/common/utils/format";
import { accessName, useAssignments, useHandover, useManagedModules, type Assignment, type HandoverResult } from "../api/access";
import { usePeopleFrom, type Person } from "../api/people";
import { PersonPicker, usePersonById } from "../components/PersonPicker";
import { ASSIGNMENTS_PATH, OWNERS_PATH } from "../utils/paths";
import "../access.css";

const STEPS = ["Module", "From", "To", "Confirm"];

/* AD-05: someone takes over another person's operator access and duties in one module.
   ?module= and ?fromUserId= prefill the first steps. A drill-in page: back to the assignments.
   The steps share one card of a fixed minimum height, so the buttons under it stay put. */
export default function HandoverWizardPage() {
  const { can } = useAuth();
  const [search] = useSearchParams();
  const { modules, isLoading } = useManagedModules();
  const handover = useHandover();

  const [step, setStep] = useState(0);
  const [module, setModule] = useState(search.get("module") ?? "");
  const [from, setFrom] = useState<Person | null>(null);
  const [to, setTo] = useState<Person | null>(null);
  const [includeOwnership, setIncludeOwnership] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HandoverResult | null>(null);

  useEffect(() => {
    if (!module && modules.length === 1) setModule(modules[0].value);
  }, [modules]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Everyone with live access in the module, so a deactivated person can still be picked */
  const current = useAssignments({ module, status: "ACTIVE", limit: 100 }, !!module);
  const known = usePeopleFrom(current.rows);
  const prefFrom = usePersonById(search.get("fromUserId"), known);
  useEffect(() => {
    if (prefFrom && !from) setFrom(prefFrom);
  }, [prefFrom]); // eslint-disable-line react-hooks/exhaustive-deps

  const moduleLabel = modules.find(m => m.value === module)?.label ?? module;
  const fromRows = (current.rows ?? []).filter(a => a.userId === from?.id && (a.kind === "OPERATOR" || includeOwnership));
  const defaultNote = from ? `Handed over from ${from.name}` : "";

  const go = (next: number) => {
    setError(null);
    setStep(next);
  };

  const submit = () => {
    if (!from || !to) return;
    setError(null);
    handover.mutate(
      { module, fromUserId: from.id, toUserId: to.id, note: note.trim() || undefined, includeOwnership: includeOwnership || undefined },
      { onSuccess: res => setResult(res.data), onError: e => setError(errorMessage(e)) }
    );
  };

  const restart = () => {
    setResult(null);
    setFrom(null);
    setTo(null);
    setNote("");
    setIncludeOwnership(false);
    handover.reset();
    go(0);
  };

  const header = (
    <>
      <DrillHeader back={ASSIGNMENTS_PATH} backLabel="Back to assignments" title="Hand over work" />
      <p className="muted">Move one person's operator access and the records in their charge to someone else.</p>
    </>
  );

  if (!isLoading && modules.length === 0)
    return (
      <Page>
        {header}
        <EmptyState title="No module to hand over in" message="Handovers are for the add-on modules you administer." />
      </Page>
    );

  return (
    <Page>
      {header}
      {/* Stays on the done screen too (every step ticked), so the page doesn't jump */}
      <Stepper steps={STEPS} current={result ? STEPS.length : step} onStepClick={result ? undefined : go} />
      {result ? (
        <HandoverDone result={result} message={handover.data?.message ?? ""} onAgain={restart} />
      ) : (
        <>
          <Card className="handover-step">
            {step === 0 && (
              <div className="stack">
                <Select
                  label="Module"
                  required
                  placeholder="Choose a module"
                  options={modules}
                  value={module}
                  onChange={e => {
                    setModule(e.target.value);
                    setFrom(null);
                    setTo(null);
                  }}
                />
                <div className="small muted">The handover covers this module only. Repeat it for other modules.</div>
              </div>
            )}

            {step === 1 && (
              <div className="stack">
                <div className="section-title">Who is leaving or handing over</div>
                {current.isLoading ? (
                  <SkeletonBlock lines={4} />
                ) : known.length > 0 ? (
                  <div className="picker-list" role="radiogroup" aria-label="People with access in this module">
                    {known.map(p => (
                      <label key={p.id} className="picker-radio">
                        <input type="radio" name="from" checked={from?.id === p.id} onChange={() => setFrom(p)} />
                        <PersonCell name={p.name} sub={rolesOf(current.rows, p.id)} extra={<RoleBadge role={p.role} />} />
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="muted">Nobody holds an active role in the {moduleLabel} module.</div>
                )}
                <PersonPicker
                  label="Or someone else (for example, the warden of a hostel without a role)"
                  value={from && !known.some(k => k.id === from.id) ? from : null}
                  onChange={setFrom}
                  exclude={known.map(k => k.id)}
                />
              </div>
            )}

            {step === 2 && (
              <div className="stack">
                <PersonPicker label="Who takes over" required value={to} onChange={setTo} exclude={from ? [from.id] : []} hint="An active employee." />
                {can("administration.access.manageOwners") && (
                  <Checkbox
                    label={`Also hand over ${from?.name ?? "their"}'s ownership of the ${moduleLabel} module`}
                    checked={includeOwnership}
                    onChange={e => setIncludeOwnership(e.target.checked)}
                  />
                )}
              </div>
            )}

            {step === 3 && from && to && (
              <div className="stack">
                <Alert tone="info" title="Check before you confirm">
                  All of {from.name}'s operator access{includeOwnership ? " and ownership" : ""} in {moduleLabel} moves to {to.name} from today,
                  with the records in {from.name}'s charge. History is not changed.
                </Alert>
                {fromRows.length > 0 && (
                  <div>
                    <div className="section-title" style={{ marginBottom: 6 }}>
                      Moving
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {fromRows.map(a => (
                        <li key={a.id}>
                          {accessName(a)} {a.validTo ? `(until ${formatDate(a.validTo)})` : "(no end date)"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Textarea label="Note" rows={2} maxLength={500} placeholder={defaultNote} value={note} onChange={e => setNote(e.target.value)} hint="Saved on the new assignments." />
              </div>
            )}
          </Card>

          {/* Back keeps its place (hidden on the first step); an error takes the line between the buttons */}
          <div className="form-actions-bar">
            <Button
              icon={<ArrowLeft />}
              onClick={() => go(step - 1)}
              disabled={handover.isPending || step === 0}
              style={{ visibility: step > 0 ? "visible" : "hidden" }}
            >
              Back
            </Button>
            <FooterStatus>{error ? `Nothing was handed over: ${error}` : null}</FooterStatus>
            <div className="row">
              <ButtonLink to={ASSIGNMENTS_PATH}>Cancel</ButtonLink>
              {step < 3 ? (
                <Button
                  variant="primary"
                  icon={<ArrowRight />}
                  onClick={() => go(step + 1)}
                  disabled={(step === 0 && !module) || (step === 1 && !from) || (step === 2 && !to)}
                >
                  Next
                </Button>
              ) : (
                <Button variant="primary" icon={<Repeat />} onClick={submit} loading={handover.isPending}>
                  Hand over
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </Page>
  );
}

const rolesOf = (rows: Assignment[] | undefined, userId: string) =>
  (rows ?? [])
    .filter(a => a.userId === userId)
    .map(accessName)
    .join(", ");

function HandoverDone({ result, message, onAgain }: { result: HandoverResult; message: string; onAgain: () => void }) {
  const { can } = useAuth();
  const groups = result.records.filter(g => g.count > 0);
  return (
    <div className="stack">
      <Alert tone="success" title="Handed over">
        {message}
      </Alert>
      <div className="grid-2">
        <Card title="Assignments moved" subtitle={`To ${result.to.name}`}>
          {result.assignments.length === 0 ? (
            <div className="muted">No operator access to move.</div>
          ) : (
            <ul className="stack-sm" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {result.assignments.map(a => (
                <li key={a.assignmentId} className="row-between">
                  <span>
                    <CheckCircle2 size={14} style={{ color: "var(--success-text)", verticalAlign: -2 }} /> {a.label}
                    <span className="small muted">
                      {" "}
                      · {a.validFrom ? `from ${formatDate(a.validFrom)}` : "now"}
                      {a.validTo ? ` until ${formatDate(a.validTo)}` : ", no end date"}
                    </span>
                  </span>
                  <Link
                    className="small"
                    to={`${a.kind === "OWNER" ? OWNERS_PATH : ASSIGNMENTS_PATH}?module=${result.module}&userId=${result.to.id}&open=${a.assignmentId}`}
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Records reassigned">
          {groups.length === 0 ? (
            <div className="muted">No records were in {result.from.name}'s charge.</div>
          ) : (
            <div className="stack-sm">
              {groups.map(g => (
                <div key={g.kind}>
                  <strong>{g.label}</strong> ({g.count}): {g.records.map(r => r.name).join(", ")}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Alert tone="warning">
        If {result.from.name}'s own role still gives access to the {result.moduleLabel} module, change their role or deactivate them
        {can("users.accounts.read") ? (
          <>
            {" "}
            in <Link to={`/users/${result.from.id}`}>their account</Link>.
          </>
        ) : (
          "."
        )}
      </Alert>
      <div className="form-actions">
        <Button onClick={onAgain}>Hand over more work</Button>
        <ButtonLink variant="primary" to={`${ASSIGNMENTS_PATH}?module=${result.module}`}>
          Back to assignments
        </ButtonLink>
      </div>
    </div>
  );
}

