import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Badge, Button, Checkbox, DescriptionList, Dialog, EmptyState, RadioGroup, Select, Skeleton, Stepper, TextInput, Textarea, useToast } from "@/common/ui";
import { isApiError } from "@/common/api";
import { formatDate, todayIso } from "@/common/utils/format";
import { SectionSelect, sectionTitle, useSectionOptions } from "@/modules/academics";
import { useClassOptions } from "../../shared";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import "../../shared/operations.css";
import { generateInvoices, useInvoiceMutation, type GenerationInput, type GenerationResult } from "../api/invoices";
import { useSectionRoster, useStructureOptions } from "../api/pickers";

type Scope = "CLASS" | "SECTION" | "STUDENTS";

const STEPS = ["Fee structure", "Who", "Dates", "Confirm"];

/* FI-07 generation wizard: structure → scope → dates → confirm → result. Running it again is
   safe: invoices already issued for an installment are skipped. */
export function GenerateInvoicesDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const structures = useStructureOptions();
  const classes = useClassOptions();
  const sections = useSectionOptions();
  const [step, setStep] = useState(0);
  const [structureId, setStructureId] = useState("");
  const [scope, setScope] = useState<Scope>("CLASS");
  const [sectionId, setSectionId] = useState("");
  const [studentIds, setStudentIds] = useState<Set<string>>(new Set());
  const [throughDate, setThroughDate] = useState("");
  const [issueDate, setIssueDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GenerationResult | null>(null);

  const structure = structures.byId.get(structureId);
  const className = structure ? classes.byId.get(structure.classId)?.className : undefined;
  const section = sections.byId.get(sectionId);
  const roster = useSectionRoster(scope === "STUDENTS" && sectionId ? sectionId : null);
  const generate = useInvoiceMutation(generateInvoices);

  const structureOptions = useMemo(
    () => structures.options.map(o => ({ ...o, description: classes.byId.get(structures.byId.get(o.value)?.classId ?? "")?.className })),
    [structures.options, structures.byId, classes.byId]
  );

  const scopeLabel =
    scope === "CLASS"
      ? `Every section of ${className ?? "the class"}`
      : scope === "SECTION"
        ? section
          ? sectionTitle(section)
          : "One section"
        : `${studentIds.size} chosen student${studentIds.size === 1 ? "" : "s"}${section ? ` of ${sectionTitle(section)}` : ""}`;

  const check = (s: number): string | null => {
    if (s === 0 && !structureId) return "Pick a fee structure";
    if (s === 1 && scope === "SECTION" && !sectionId) return "Pick a section";
    if (s === 1 && scope === "STUDENTS" && studentIds.size === 0) return "Choose at least one student";
    return null;
  };

  const next = () => {
    const problem = check(step);
    setError(problem);
    if (!problem) setStep(s => s + 1);
  };

  const submit = () => {
    setError(null);
    setFieldErrors({});
    const body: GenerationInput = {
      feeStructureId: structureId,
      sectionId: scope === "SECTION" ? sectionId : undefined,
      studentIds: scope === "STUDENTS" ? [...studentIds] : undefined,
      throughDate: throughDate || undefined,
      issueDate: issueDate || undefined,
      notes: notes.trim() || undefined
    };
    generate.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        setResult(res.data);
      },
      onError: err => {
        if (isApiError(err) && err.isValidation) {
          const map: Record<string, string> = {};
          for (const d of err.details) if (d.field && !map[d.field]) map[d.field] = d.message;
          setFieldErrors(map);
          /* Dates are on step 3: go back to the step holding the first wrong field */
          if (map.throughDate || map.issueDate || map.notes) setStep(2);
          else if (map.sectionId || map.studentIds) setStep(1);
          setError("Please correct the highlighted fields.");
        } else setError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
      }
    });
  };

  const toggleStudent = (id: string) =>
    setStudentIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const rosterRows = roster.data ?? [];
  const allPicked = rosterRows.length > 0 && rosterRows.every(r => studentIds.has(r.studentId));

  const footer = result ? (
    <>
      <Button
        onClick={() => {
          onClose();
          navigate(`${OPS_PATHS.invoices}?feeStructureId=${structureId}`);
        }}
      >
        Show these invoices
      </Button>
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    </>
  ) : (
    <>
      {step > 0 ? <Button onClick={() => setStep(s => s - 1)}>Back</Button> : <Button onClick={onClose}>Cancel</Button>}
      {step < 3 ? (
        <Button variant="primary" onClick={next}>
          Next
        </Button>
      ) : (
        <Button variant="primary" loading={generate.isPending} onClick={submit}>
          Generate invoices
        </Button>
      )}
    </>
  );

  return (
    <Dialog open onClose={onClose} title="Generate invoices" wide footer={footer} footerStatus={result ? null : error}>
      {result ? (
        <EmptyState
          icon={<CheckCircle2 />}
          title={`${result.created} invoice${result.created === 1 ? "" : "s"} issued`}
          message={
            <div className="stack-sm" style={{ alignItems: "center" }}>
              <div>
                {result.skipped > 0 ? `${result.skipped} already issued, skipped. ` : ""}Installments due up to {formatDate(result.throughDate)}.
              </div>
              {result.byPlan.length > 0 && (
                <div className="chips" style={{ justifyContent: "center" }}>
                  {result.byPlan.map(p => (
                    <Badge key={p.name}>
                      {p.name}: {p.invoices}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          }
        />
      ) : (
        <div className="stack" style={{ minHeight: 320 }}>
          <Stepper steps={STEPS} current={step} onStepClick={i => setStep(i)} />
          {step === 0 && (
            <Select
              label="Fee structure"
              value={structureId}
              onChange={e => {
                setStructureId(e.target.value);
                setSectionId("");
                setStudentIds(new Set());
              }}
              options={structureOptions}
              placeholder={structures.isLoading ? "Loading…" : "Pick a fee structure"}
              required
              error={fieldErrors.feeStructureId}
              hint="Each student is billed by their own installment plan, or the structure's default."
            />
          )}
          {step === 1 && (
            <>
              <RadioGroup<Scope>
                aria-label="Who to bill"
                value={scope}
                onChange={v => {
                  setScope(v);
                  setStudentIds(new Set());
                }}
                options={[
                  { value: "CLASS", label: `Whole ${className ?? "class"}`, description: "Every student enrolled in a section of the class" },
                  { value: "SECTION", label: "One section" },
                  { value: "STUDENTS", label: "Chosen students", description: "Pick from a section's roster" }
                ]}
              />
              {scope !== "CLASS" && (
                <SectionSelect
                  value={sectionId}
                  onChange={e => {
                    setSectionId(e.target.value);
                    setStudentIds(new Set());
                  }}
                  classId={structure?.classId}
                  required
                  error={fieldErrors.sectionId}
                />
              )}
              {scope === "STUDENTS" && sectionId && (
                <div className="stack-sm">
                  <div className="row-between">
                    <Checkbox
                      label={`All ${rosterRows.length} students`}
                      checked={allPicked}
                      disabled={!rosterRows.length}
                      onChange={() => setStudentIds(allPicked ? new Set() : new Set(rosterRows.map(r => r.studentId)))}
                    />
                    <span className="small muted">{studentIds.size} chosen</span>
                  </div>
                  <div className="roster-picks">
                    {roster.isLoading
                      ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} width="60%" />)
                      : rosterRows.map(r => (
                          <Checkbox
                            key={r.studentId}
                            checked={studentIds.has(r.studentId)}
                            onChange={() => toggleStudent(r.studentId)}
                            label={
                              <span>
                                {r.student.user.firstName} {r.student.user.lastName} <span className="muted small">{r.student.admissionNumber}</span>
                              </span>
                            }
                          />
                        ))}
                    {!roster.isLoading && !rosterRows.length && <span className="muted">No active students in this section.</span>}
                  </div>
                  {fieldErrors.studentIds && <div className="small field-error">{fieldErrors.studentIds}</div>}
                </div>
              )}
            </>
          )}
          {step === 2 && (
            <div className="form-grid">
              <TextInput
                type="date"
                label="Bill installments due up to"
                value={throughDate}
                onChange={e => setThroughDate(e.target.value)}
                hint="Leave empty for the whole year"
                error={fieldErrors.throughDate}
              />
              <TextInput type="date" label="Issue date" value={issueDate} onChange={e => setIssueDate(e.target.value)} error={fieldErrors.issueDate} />
              <Textarea
                label="Notes"
                fieldClassName="span-2"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                hint="Printed on each invoice"
                error={fieldErrors.notes}
              />
            </div>
          )}
          {step === 3 && (
            <DescriptionList
              columns={1}
              items={[
                { label: "Fee structure", value: structure?.name },
                { label: "Who", value: scopeLabel },
                { label: "Installments due up to", value: throughDate ? formatDate(throughDate) : "The whole year" },
                { label: "Issue date", value: formatDate(issueDate) || "Today" },
                { label: "Notes", value: notes.trim(), hidden: !notes.trim() }
              ]}
            />
          )}
        </div>
      )}
    </Dialog>
  );
}
