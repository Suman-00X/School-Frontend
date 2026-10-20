import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FileDown } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, ErrorState, SkeletonBlock, Textarea, TextInput, useToast } from "@/common/ui";
import { HPC_PATH, downloadHpcPdf, hpcStudentPath, saveHpc, type HpcCard, type HpcEntry, type HpcLevel, type HpcStage, type ReflectionKey } from "../api/holisticProgress";

const EMPTY_ENTRY = { awareness: null, sensitivity: null, creativity: null, selfAssessment: null, peerAssessment: null, remark: null };

/* Three levels as one segmented control; clicking the chosen level clears it */
function LevelPicker({
  stage,
  value,
  onChange,
  disabled,
  label
}: {
  stage: HpcStage;
  value: HpcLevel | null;
  onChange: (v: HpcLevel | null) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="hpc-levels" role="radiogroup" aria-label={label}>
      {stage.levels.map(l => (
        <button
          key={l.value}
          type="button"
          role="radio"
          aria-checked={value === l.value}
          className={value === l.value ? "is-on" : undefined}
          disabled={disabled}
          onClick={() => onChange(value === l.value ? null : l.value)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

type Draft = { entries: Record<string, HpcEntry>; reflections: Record<ReflectionKey, string> };

const draftOf = (card: HpcCard): Draft => ({
  entries: Object.fromEntries(card.subjects.map(({ subject, entry }) => [subject.id, entry ?? { subjectId: subject.id, ...EMPTY_ENTRY }])),
  reflections: Object.fromEntries(card.reflections.map(r => [r.key, card[r.key] ?? ""])) as Record<ReflectionKey, string>
});

const GENDER: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

/* One student's Holistic Progress Card for the exam: abilities per subject, self and peer
   assessment, reflections; the result and attendance beside it are read-only */
export function HpcDrawer({
  examId,
  studentId,
  onClose,
  onNext
}: {
  examId: string;
  studentId: string;
  onClose: () => void;
  onNext?: () => void;
}) {
  const { can } = useAuth();
  const toast = useToast();
  const canRecord = can("academics.holisticProgress.record");
  const qc = useQueryClient();
  const cardPath = hpcStudentPath(examId, studentId);
  const card = useApiGet<HpcCard>(cardPath);
  const save = useApiMutation(saveHpc, { invalidate: [HPC_PATH] });
  /* null until the first change: the form shows the saved card */
  const [edits, setEdits] = useState<Draft | null>(null);
  const [downloading, setDownloading] = useState(false);

  const data = card.data;
  const draft = edits ?? (data ? draftOf(data) : null);
  const edit = (change: (d: Draft) => Draft) => {
    if (data) setEdits(d => change(d ?? draftOf(data)));
  };
  const setEntry = (subjectId: string, patch: Partial<HpcEntry>) =>
    edit(d => ({ ...d, entries: { ...d.entries, [subjectId]: { ...d.entries[subjectId], ...patch } } }));
  const setReflection = (key: ReflectionKey, value: string) => edit(d => ({ ...d, reflections: { ...d.reflections, [key]: value } }));

  const dirty = !!data && !!edits && JSON.stringify(edits) !== JSON.stringify(draftOf(data));

  const submit = (then?: () => void) => {
    if (!draft || !data) return;
    save.mutate(
      {
        examId,
        studentId,
        body: {
          subjects: data.subjects.map(({ subject }) => ({ ...draft.entries[subject.id], remark: draft.entries[subject.id].remark?.trim() || null })),
          ...Object.fromEntries(Object.entries(draft.reflections).map(([k, v]) => [k, v.trim() || null]))
        }
      },
      {
        onSuccess: res => {
          /* The answer is the saved card: show it without waiting for a refetch */
          qc.setQueryData([cardPath, {}], res.data);
          setEdits(null);
          toast.success(res.message);
          then?.();
        },
        onError: err => toast.error(err)
      }
    );
  };

  const pdf = async () => {
    setDownloading(true);
    try {
      await downloadHpcPdf(examId, studentId);
    } catch (err) {
      toast.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const name = data ? [data.student.firstName, data.student.middleName, data.student.lastName].filter(Boolean).join(" ") : "Holistic Progress Card";

  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title={name}
      subtitle={data ? `${data.stage.label} stage · ${data.exam.examName} · ${data.student.section.name}${data.student.rollNumber ? ` · Roll ${data.student.rollNumber}` : ""}` : undefined}
      footerStatus={dirty ? "Unsaved changes" : undefined}
      footer={
        <>
          <Button icon={<FileDown />} loading={downloading} disabled={!data || dirty} title={dirty ? "Save first" : undefined} onClick={() => void pdf()}>
            PDF
          </Button>
          {canRecord && onNext && (
            <Button icon={<ChevronRight />} disabled={!data || save.isPending} onClick={() => (dirty ? submit(onNext) : onNext())}>
              {dirty ? "Save and next" : "Next student"}
            </Button>
          )}
          {canRecord && (
            <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={() => submit()}>
              Save
            </Button>
          )}
        </>
      }
    >
      {card.error ? (
        <ErrorState error={card.error} onRetry={() => void card.refetch()} />
      ) : !data || !draft ? (
        <SkeletonBlock lines={10} />
      ) : (
        <div className="stack">
          <section>
            <h3 className="section-title">Part A · About the student</h3>
            <DescriptionList
              items={[
                { label: "Admission no.", value: data.student.admissionNumber },
                { label: "Date of birth", value: data.student.dob ?? "—" },
                { label: "Gender", value: data.student.gender ? GENDER[data.student.gender] : "—" },
                { label: "Mother tongue", value: data.student.motherTongue ?? "—" },
                { label: "APAAR id", value: data.student.apaarId ?? <span className="muted">Not entered</span> },
                { label: "PEN", value: data.student.pen ?? <span className="muted">Not entered</span> },
                {
                  label: "Attendance",
                  value: data.attendance
                    ? `${data.attendance.attendedDays} of ${data.attendance.workingDays} days${data.attendance.percentage === null ? "" : ` (${data.attendance.percentage}%)`}`
                    : "—"
                }
              ]}
            />
            <Textarea
              fieldClassName="hpc-after-dl"
              label="All about me: interests"
              rows={2}
              value={draft.reflections.interests}
              disabled={!canRecord}
              placeholder="What the student enjoys, in their own words"
              onChange={e => setReflection("interests", e.target.value)}
            />
          </section>

          <section>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3 className="section-title">Part B · Learning in each subject</h3>
              <span className="hpc-legend small muted">
                Levels:
                {data.stage.levels.map(l => (
                  <Badge key={l.value}>{l.label}</Badge>
                ))}
              </span>
            </div>
            {data.subjects.length ? (
              <div className="stack">
                {data.subjects.map(({ subject }) => {
                  const entry = draft.entries[subject.id];
                  const rows: { key: keyof HpcEntry; label: string }[] = [
                    ...data.abilities.map(a => ({ key: a.key, label: a.label })),
                    { key: "selfAssessment", label: "Self-assessment" },
                    { key: "peerAssessment", label: "Peer assessment" }
                  ];
                  return (
                    <div key={subject.id} className="hpc-subject-card">
                      <div className="hpc-subject">
                        {subject.subjectName} <span className="muted small mono">{subject.subjectCode}</span>
                      </div>
                      <div className="hpc-rows">
                        {rows.map(r => (
                          <div key={r.key} className="hpc-row">
                            <span className="small">{r.label}</span>
                            <LevelPicker
                              stage={data.stage}
                              label={`${subject.subjectName}: ${r.label}`}
                              value={entry[r.key] as HpcLevel | null}
                              disabled={!canRecord}
                              onChange={v => setEntry(subject.id, { [r.key]: v })}
                            />
                          </div>
                        ))}
                      </div>
                      <TextInput
                        aria-label={`${subject.subjectName}: teacher's note`}
                        placeholder="Teacher's note on this subject (optional)"
                        maxLength={500}
                        value={entry.remark ?? ""}
                        disabled={!canRecord}
                        onChange={e => setEntry(subject.id, { remark: e.target.value })}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">This section sits no papers in {data.exam.examName}, so there are no subjects to assess.</p>
            )}
          </section>

          <section>
            <h3 className="section-title">Part C · Reflections and feedback</h3>
            {data.reflections
              .filter(r => r.key !== "interests")
              .map(r => (
                <Textarea key={r.key} label={r.label} rows={2} maxLength={2000} value={draft.reflections[r.key]} disabled={!canRecord} onChange={e => setReflection(r.key, e.target.value)} />
              ))}
          </section>

          {data.academic && (
            <section>
              <h3 className="section-title">Result of {data.exam.examName}</h3>
              <DescriptionList
                items={[
                  ...(data.academic.percentage !== null ? [{ label: "Percentage", value: `${data.academic.percentage}%` }] : []),
                  ...(data.academic.grade ? [{ label: "Grade", value: data.academic.grade }] : []),
                  { label: "Result", value: data.academic.result },
                  ...data.academic.subjects.filter(s => s.grade).map(s => ({ label: s.subjectName, value: s.grade }))
                ]}
              />
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}
