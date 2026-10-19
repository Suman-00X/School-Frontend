import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { api, errorMessage } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation } from "@/common/hooks";
import { Button, Checkbox, DescriptionList, Dialog, Field, RadioGroup, Select, SkeletonBlock, Stepper, useToast, type Option } from "@/common/ui";
import { SectionSelect, sectionTitle, useSectionOptions } from "@/modules/academics";
import { StudentSelect, useStudentOptions } from "@/modules/users";
import { useClassOptions } from "../../shared";
import { ASSIGNMENTS_PATH, assignPlan, assignPlanBulk, installmentsLabel, usePlanOptions, type AssignResult } from "../api/installmentPlans";

import "./installmentPlans.css";

type Scope = "student" | "section" | "class" | "students";

const SCOPES: { value: Scope; label: string; description: string }[] = [
  { value: "student", label: "One student", description: "Pick by name or admission number" },
  { value: "section", label: "A section", description: "Every active student of the section" },
  { value: "class", label: "A class", description: "Every section of the class" },
  { value: "students", label: "Some students", description: "Tick students from a section's roster" }
];

/* "" in the plan picker: back to each fee structure's default plan */
const DEFAULT = "default";

type RosterRow = { studentId: string; status: string; rollNumber: string | null; student: { admissionNumber: string; user: { firstName: string; lastName: string } } };

function useRoster(sectionId: string) {
  return useQuery({
    queryKey: ["/academics/enrollments", { sectionId, all: true }],
    enabled: !!sectionId,
    queryFn: async () => {
      const rows: RosterRow[] = [];
      for (let page = 1; page <= 10; page++) {
        const res = await api.get<RosterRow[]>("/academics/enrollments", { sectionId, page, limit: 100 });
        rows.push(...res.data);
        if (!res.meta || page >= res.meta.totalPages) break;
      }
      return rows.filter(r => r.status === "ACTIVE");
    }
  });
}

/* FI-02 "Assign plan": who (one student, a section, a class or some students), which plan, confirm.
   One student goes to POST /plan-assignments, the rest to /plan-assignments/bulk. */
export function AssignPlanDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: { studentId: string; planId: string | null } }) {
  const toast = useToast();
  const { selected: year } = useAcademicYear();
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState<Scope>("student");
  const [studentId, setStudentId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [classId, setClassId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const plans = usePlanOptions(open);
  const classes = useClassOptions(open);
  const sections = useSectionOptions(open);
  const students = useStudentOptions(open);
  const roster = useRoster(open && scope === "students" ? sectionId : "");
  const invalidate = [ASSIGNMENTS_PATH, "/finance/invoices", "/finance/students"];
  const single = useApiMutation(assignPlan, { invalidate });
  const bulk = useApiMutation(assignPlanBulk, { invalidate });

  useEffect(() => {
    if (!open) return;
    setStep(preset ? 1 : 0);
    setScope("student");
    setStudentId(preset?.studentId ?? "");
    setSectionId("");
    setClassId("");
    setPicked(new Set());
    setPlanId("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset?.studentId]);

  const planOptions = useMemo<Option[]>(
    () => [{ value: DEFAULT, label: "Structure default", description: "Each fee structure's own default plan" }, ...plans.options.filter(o => o.value !== preset?.planId)],
    [plans.options, preset?.planId]
  );

  const who = (() => {
    if (scope === "student") {
      const s = students.byId.get(studentId);
      return s ? `${s.user.firstName} ${s.user.lastName} (${s.admissionNumber})` : "";
    }
    if (scope === "section") return sections.byId.get(sectionId) ? sectionTitle(sections.byId.get(sectionId)!) : "";
    if (scope === "class") return classes.byId.get(classId)?.className ?? "";
    const section = sections.byId.get(sectionId);
    return picked.size ? `${picked.size} student${picked.size === 1 ? "" : "s"}${section ? ` of ${sectionTitle(section)}` : ""}` : "";
  })();
  const plan = planId && planId !== DEFAULT ? plans.byId.get(planId) : null;
  const planLabel = planId === DEFAULT ? "Each fee structure's default plan" : plan ? `${plan.name} (${installmentsLabel(plan.installmentCount)})` : "";

  const whoReady = !!who;
  const next = () => {
    setError(null);
    if (step === 0 && !whoReady) return setError(scope === "students" ? "Tick at least one student" : "Choose who the plan is for");
    if (step === 1 && !planId) return setError("Choose a plan");
    setStep(s => s + 1);
  };

  const submit = () => {
    setError(null);
    const installmentPlanId = planId === DEFAULT ? null : planId;
    const handlers = {
      onSuccess: (res: { data: AssignResult; message: string }) => {
        toast.success(res.message);
        onClose();
      },
      onError: (e: unknown) => setError(errorMessage(e))
    };
    if (scope === "student") single.mutate({ studentId, installmentPlanId }, handlers);
    else if (scope === "section") bulk.mutate({ installmentPlanId, sectionId }, handlers);
    else if (scope === "class") bulk.mutate({ installmentPlanId, classId }, handlers);
    else bulk.mutate({ installmentPlanId, studentIds: [...picked] }, handlers);
  };

  const rosterRows = roster.data ?? [];
  const allPicked = rosterRows.length > 0 && rosterRows.every(r => picked.has(r.studentId));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={preset ? "Change plan" : "Assign a plan"}
      footerStatus={error}
      footer={
        <>
          {step > (preset ? 1 : 0) ? <Button onClick={() => setStep(s => s - 1)}>Back</Button> : <Button onClick={onClose}>Cancel</Button>}
          {step < 2 ? (
            <Button variant="primary" onClick={next}>
              Next
            </Button>
          ) : (
            <Button variant="primary" onClick={submit} loading={single.isPending || bulk.isPending}>
              Assign plan
            </Button>
          )}
        </>
      }
    >
      <div className="stack">
        <Stepper steps={["Who", "Plan", "Confirm"]} current={step} onStepClick={i => i >= (preset ? 1 : 0) && setStep(i)} />
        {step === 0 && (
          <div className="stack">
            <RadioGroup
              aria-label="Who the plan is for"
              options={SCOPES}
              value={scope}
              onChange={v => {
                setScope(v);
                setError(null);
              }}
            />
            {scope === "student" && <StudentSelect value={studentId} onChange={e => setStudentId(e.target.value)} required hint="Only students active in the selected year can change plan" />}
            {scope === "section" && <SectionSelect value={sectionId} onChange={e => setSectionId(e.target.value)} required hint={`Sections of ${year?.yearName ?? "the selected year"}`} />}
            {scope === "class" && (
              <Select
                label="Class"
                required
                options={classes.options}
                value={classId}
                onChange={e => setClassId(e.target.value)}
                placeholder={classes.isLoading ? "Loading classes…" : "Pick a class"}
                hint="Every active student in the class's sections"
              />
            )}
            {scope === "students" && (
              <>
                <SectionSelect
                  value={sectionId}
                  onChange={e => {
                    setSectionId(e.target.value);
                    setPicked(new Set());
                  }}
                  required
                  hint="Then tick the students"
                />
                <Field label={`Students${picked.size ? ` · ${picked.size} ticked` : ""}`}>
                  <div className="roster-pick">
                    {!sectionId ? (
                      <p className="muted small">Pick a section to see its students.</p>
                    ) : roster.isLoading ? (
                      <SkeletonBlock lines={4} />
                    ) : !rosterRows.length ? (
                      <p className="muted small">No active students in this section.</p>
                    ) : (
                      <>
                        <Checkbox
                          label={<strong>All {rosterRows.length}</strong>}
                          checked={allPicked}
                          onChange={() => setPicked(allPicked ? new Set() : new Set(rosterRows.map(r => r.studentId)))}
                        />
                        {rosterRows.map(r => (
                          <Checkbox
                            key={r.studentId}
                            label={
                              <span>
                                {r.student.user.firstName} {r.student.user.lastName} <span className="muted small">{r.student.admissionNumber}</span>
                              </span>
                            }
                            checked={picked.has(r.studentId)}
                            onChange={() =>
                              setPicked(p => {
                                const n = new Set(p);
                                if (n.has(r.studentId)) n.delete(r.studentId);
                                else n.add(r.studentId);
                                return n;
                              })
                            }
                          />
                        ))}
                      </>
                    )}
                  </div>
                </Field>
              </>
            )}
          </div>
        )}
        {step === 1 && (
          <div className="stack">
            {planOptions.length <= 4 ? (
              <RadioGroup aria-label="Plan" options={planOptions} value={planId} onChange={setPlanId} />
            ) : (
              <Select label="Plan" required options={planOptions} value={planId} onChange={e => setPlanId(e.target.value)} placeholder="Pick a plan" />
            )}
            <p className="small muted">
              A plan can only be assigned where a fee structure of the student's class offers it. Students on the structure default pay by each structure's own default plan.
            </p>
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <DescriptionList
              columns={1}
              items={[
                { label: "Who", value: who },
                { label: "Plan", value: planLabel },
                { label: "Year", value: year?.yearName }
              ]}
            />
            <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
              <AlertTriangle size={16} style={{ color: "var(--warning-text)", flexShrink: 0, marginTop: 2 }} />
              <p className="small">
                Unpaid invoices under the old plan will be cancelled and re-issued. A student who has already paid towards this year's invoices can't change plan.
              </p>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
