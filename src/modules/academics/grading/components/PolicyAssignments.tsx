import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Repeat, Target, Trash2 } from "lucide-react";
import { api, errorMessage, isApiError } from "@/common/api";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, Dialog, EmptyState, Menu, MenuItem, Select, Skeleton, useConfirm, useToast } from "@/common/ui";
import { byClassOrder, CLASSES_PATH, type SchoolClass } from "../../classes/api/classes";
import { SectionSelect } from "../../shared/components/SectionSelect";
import { useExamOptions } from "../api/assessmentSchemes";
import {
  assignmentTarget,
  changeAssignment,
  createAssignment,
  deleteAssignment,
  gradingModeLabel,
  POLICY_ASSIGNMENTS_PATH,
  RESULT_POLICIES_PATH,
  SOURCE_TEXT,
  usePolicyOptions,
  type PolicyAssignment,
  type Resolution
} from "../api/resultPolicies";

function useClassOptions() {
  const list = useApiList<SchoolClass>(CLASSES_PATH, { limit: 100 });
  return (list.rows ? [...list.rows].sort(byClassOrder) : []).map(c => ({ value: c.id, label: c.className }));
}

/* "Which rules apply?": pick an exam and/or a class (or section) and see the winning policy and why */
function WhichRulesApply() {
  const exams = useExamOptions();
  const classes = useClassOptions();
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const query = { examId: examId || undefined, classId: sectionId ? undefined : classId || undefined, sectionId: sectionId || undefined };
  const any = !!(examId || classId || sectionId);
  const res = useQuery({
    queryKey: [`${RESULT_POLICIES_PATH}/resolution`, query],
    enabled: any,
    placeholderData: prev => prev,
    queryFn: async () => (await api.get<Resolution>(`${RESULT_POLICIES_PATH}/resolution`, query)).data
  });
  const r = any ? res.data : undefined;
  return (
    <Card title="Which rules apply?" subtitle="The most specific wins: exam in a class, then exam, then class, then the school default">
      <div className="stack-sm">
        <div className="filter-bar filter-bar-plain">
          {exams.allowed && <Select label="Exam" options={exams.options} value={examId} placeholder="Any exam" onChange={e => setExamId(e.target.value)} />}
          <Select
            label="Class"
            options={classes}
            value={classId}
            placeholder="Any class"
            onChange={e => {
              setClassId(e.target.value);
              setSectionId("");
            }}
          />
          <SectionSelect label="or section" value={sectionId} classId={classId || undefined} placeholder="Any section" onChange={e => setSectionId(e.target.value)} />
        </div>
        {/* One reserved line: the answer, a prompt or the error */}
        <div className="resolution-line" aria-live="polite">
          {!any ? (
            <span className="muted">Pick an exam, a class or a section.</span>
          ) : res.error ? (
            <span style={{ color: "var(--danger)" }}>{errorMessage(res.error)}</span>
          ) : !r ? (
            <Skeleton width={320} />
          ) : (
            <span>
              <strong>{r.policy.name}</strong> <Badge>{gradingModeLabel(r.policy.gradingMode)}</Badge> <span className="muted">· {SOURCE_TEXT[r.source]}</span>
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

/* AC-06, "Policy assignments": which policy an exam, a class, or an exam in one class uses */
export function PolicyAssignments({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { params, setParam, setPage } = useListParams({ policy: "" });
  const policies = usePolicyOptions();
  const list = useApiList<PolicyAssignment>(POLICY_ASSIGNMENTS_PATH, { page: params.page, limit: params.limit, policyId: params.policy || undefined });
  const remove = useApiMutation(deleteAssignment, { invalidate: [POLICY_ASSIGNMENTS_PATH, `${RESULT_POLICIES_PATH}/resolution`] });
  const [dialog, setDialog] = useState<{ assignment: PolicyAssignment | null } | null>(null);

  const askRemove = async (a: PolicyAssignment) => {
    const ok = await confirm({
      title: `Stop applying ${a.policy.name} to ${assignmentTarget(a)}?`,
      message: `${assignmentTarget(a)} then follows the next rule that fits: the exam's or class's policy, else the school default.`,
      confirmLabel: "Remove"
    });
    if (ok) remove.mutate(a.id, { onSuccess: res => toast.success(res.message), onError: err => toast.error(err) });
  };

  return (
    <div className="stack">
      <WhichRulesApply />
      <Card
        flush
        title="Assignments"
        actions={
          canManage && (
            <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setDialog({ assignment: null })}>
              Apply a policy
            </Button>
          )
        }
      >
        <div className="filter-bar">
          <Select label="Policy" options={policies.options} value={params.policy} placeholder="All policies" onChange={e => setParam("policy", e.target.value)} />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={a => a.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          empty={
            <EmptyState
              icon={<Target />}
              title={params.policy ? "This policy isn't applied to anything" : "No policy is applied to an exam or class"}
              message={params.policy ? undefined : "Every result follows the school default policy. Apply another one to an exam, a class, or an exam in one class."}
            />
          }
          columns={[
            {
              key: "target",
              header: "Applies to",
              render: a => (
                <div>
                  <div style={{ fontWeight: 550 }}>{assignmentTarget(a)}</div>
                  <div className="small muted">{a.exam && a.class ? "Exam in one class" : a.exam ? "Exam" : "Class"}</div>
                </div>
              )
            },
            { key: "policy", header: "Policy", render: a => a.policy.name },
            { key: "mode", header: "Results show", render: a => <Badge>{gradingModeLabel(a.policy.gradingMode)}</Badge> },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 56,
              render: a =>
                canManage && (
                  <div className="row-actions" onClick={e => e.stopPropagation()}>
                    <Menu trigger={toggle => <Button size="sm" variant="ghost" icon={<MoreHorizontal />} onClick={toggle} aria-label={`Actions for ${assignmentTarget(a)}`} />}>
                      {close => (
                        <>
                          <MenuItem
                            icon={<Repeat />}
                            onClick={() => {
                              close();
                              setDialog({ assignment: a });
                            }}
                          >
                            Change policy
                          </MenuItem>
                          <MenuItem
                            icon={<Trash2 />}
                            danger
                            onClick={() => {
                              close();
                              void askRemove(a);
                            }}
                          >
                            Remove
                          </MenuItem>
                        </>
                      )}
                    </Menu>
                  </div>
                )
            }
          ]}
        />
      </Card>
      {dialog && <AssignmentDialog assignment={dialog.assignment} onClose={() => setDialog(null)} />}
    </div>
  );
}

function AssignmentDialog({ assignment, onClose }: { assignment: PolicyAssignment | null; onClose: () => void }) {
  const toast = useToast();
  const policies = usePolicyOptions();
  const exams = useExamOptions();
  const classes = useClassOptions();
  const [policyId, setPolicyId] = useState(assignment?.policyId ?? "");
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const invalidate = [POLICY_ASSIGNMENTS_PATH, `${RESULT_POLICIES_PATH}/resolution`];
  const add = useApiMutation(createAssignment, { invalidate });
  const change = useApiMutation(changeAssignment, { invalidate });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!policyId) errs.policyId = "Pick a policy";
    if (!assignment && !examId && !classId) errs.examId = "Pick an exam, a class, or both";
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    const onError = (err: unknown) => {
      if (isApiError(err) && err.isValidation) setErrors(err.fieldErrors());
      setFormError(errorMessage(err));
    };
    if (assignment) change.mutate({ id: assignment.id, policyId }, { onSuccess: done, onError });
    else add.mutate({ policyId, ...(examId ? { examId } : {}), ...(classId ? { classId } : {}) }, { onSuccess: done, onError });
  };

  const target = assignment ? assignmentTarget(assignment) : examId || classId ? assignmentTarget({ exam: examId ? { id: examId, examName: exams.byId.get(examId)?.examName ?? "The exam", academicYearId: "" } : null, class: classId ? { id: classId, className: classes.find(c => c.value === classId)?.label ?? "The class" } : null }) : null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={assignment ? `Change the policy of ${assignmentTarget(assignment)}` : "Apply a policy"}
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="assignment-form" variant="primary" loading={add.isPending || change.isPending}>
            {assignment ? "Change policy" : "Apply"}
          </Button>
        </>
      }
    >
      <form id="assignment-form" className="stack" onSubmit={submit} noValidate>
        <Select
          label="Policy"
          required
          options={assignment ? policies.options.map(o => ({ ...o, disabled: o.value === assignment.policyId })) : policies.options}
          value={policyId}
          placeholder={policies.isLoading ? "Loading policies…" : "Pick a policy"}
          error={errors.policyId}
          onChange={e => setPolicyId(e.target.value)}
        />
        {!assignment && (
          <>
            <Select
              label="Exam"
              options={exams.options}
              value={examId}
              placeholder="Every exam"
              hint="Exams of the year chosen in the header"
              error={errors.examId}
              onChange={e => {
                setExamId(e.target.value);
                setErrors({});
              }}
            />
            <Select
              label="Class"
              options={classes}
              value={classId}
              placeholder="Every class"
              hint={target ? `Applies to ${target}` : "Pick an exam, a class, or both"}
              onChange={e => {
                setClassId(e.target.value);
                setErrors({});
              }}
            />
          </>
        )}
      </form>
    </Dialog>
  );
}
