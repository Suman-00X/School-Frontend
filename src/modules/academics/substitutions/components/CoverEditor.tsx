import { useMemo, useState } from "react";
import { isApiError } from "@/common/api";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { Button, RadioGroup, Select, Skeleton, TextInput, useToast, type Option } from "@/common/ui";
import {
  ACTIVITY_SUGGESTIONS,
  CANDIDATES_PATH,
  SUBSTITUTIONS_INVALIDATE,
  assignCover,
  type Candidate,
  type Candidates,
  type CoverItem,
  type SubstitutionKind
} from "../api/substitutions";

const message = (e: unknown) => (isApiError(e) ? e.message : "Something went wrong. Please try again.");

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* "Suggested · Teaches this class · 3 lessons that day" / "Unavailable: they teach Maths in Class 7-B then" */
const describe = (c: Candidate, subjectName: string, suggested: boolean) => {
  if (!c.available) return `Unavailable: ${c.unavailableReason}`;
  const load = `${plural(c.lessonsThatDay, "lesson")}${c.coversThatDay ? ` + ${plural(c.coversThatDay, "cover")}` : ""} that day`;
  return [suggested && "Suggested", c.teachesSection ? "Teaches this class" : c.teachesSubject && `Teaches ${subjectName}`, load]
    .filter(Boolean)
    .join(" · ");
};

/* Plan one lesson of an absent teacher: a substitute (their own subject or the lesson's), an
   extra or co-curricular activity (with a teacher in charge or none), or leisure. For a half
   day whose half isn't recorded, the teacher may take it after all. */
export function CoverEditor({ item, date, halfDay, onClose }: { item: CoverItem; date: string; halfDay: boolean; onClose: () => void }) {
  const toast = useToast();
  const candidates = useApiGet<Candidates>(CANDIDATES_PATH, { date, timetableSlotId: item.timetableSlotId });
  const plan = item.plan;
  const [kind, setKind] = useState<SubstitutionKind>(plan?.kind ?? "SUBSTITUTE");
  /* null: not chosen yet -> the plan's teacher, or for a new plan the best one (one click to save) */
  const [chosenTeacher, setTeacherId] = useState<string | null>(plan ? (plan.substitute?.id ?? "") : null);
  const [subjectId, setSubjectId] = useState(plan?.subject?.id ?? "");
  const [activity, setActivity] = useState(plan?.activity ?? "");
  const [note, setNote] = useState(plan?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = useApiMutation(assignCover, { invalidate: SUBSTITUTIONS_INVALIDATE });

  const teachers = candidates.data?.teachers;
  const suggestedId = teachers?.find(c => c.available)?.teacherId;
  const teacherId = chosenTeacher ?? suggestedId ?? "";

  const teacherOptions: Option[] = useMemo(
    () =>
      (teachers ?? []).map(c => ({
        value: c.teacherId,
        label: c.name,
        disabled: !c.available,
        description: describe(c, item.subject.subjectName, c.teacherId === suggestedId)
      })),
    [teachers, item.subject.subjectName, suggestedId]
  );
  const subjectOptions: Option[] = (candidates.data?.subjects ?? [])
    .filter(s => s.id !== item.subject.id)
    .map(s => ({ value: s.id, label: s.subjectName }));
  const activityOptions: Option[] = [...new Set([...ACTIVITY_SUGGESTIONS, ...(plan?.activity ? [plan.activity] : [])])].map(a => ({ value: a, label: a }));

  const kinds: { value: SubstitutionKind; label: string; description: string }[] = [
    { value: "SUBSTITUTE", label: "Substitute teacher", description: "Another teacher takes the class" },
    { value: "ACTIVITY", label: "Activity", description: "Extra or co-curricular, with or without a teacher" },
    { value: "LEISURE", label: "Leisure", description: "Nobody covers it; no register is due" },
    ...(halfDay ? [{ value: "NOT_NEEDED" as const, label: "Teacher takes it", description: "Their half day doesn't miss this period" }] : [])
  ];

  const submit = () => {
    setError(null);
    if (kind === "SUBSTITUTE" && !teacherId) return setError("Choose the teacher who takes the class.");
    if (kind === "ACTIVITY" && !activity.trim()) return setError("Name the activity.");
    save.mutate(
      {
        date,
        timetableSlotId: item.timetableSlotId,
        kind,
        ...((kind === "SUBSTITUTE" || kind === "ACTIVITY") && teacherId && { substituteTeacherId: teacherId }),
        ...(kind === "SUBSTITUTE" && subjectId && { subjectId }),
        ...(kind === "ACTIVITY" && { activity: activity.trim() }),
        ...(note.trim() && { note: note.trim() })
      },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: e => setError(message(e))
      }
    );
  };

  const teacherPicker = (label: string, required: boolean) =>
    candidates.isLoading ? (
      <Skeleton height={36} />
    ) : (
      <Select
        label={label}
        required={required}
        options={teacherOptions}
        value={teacherId}
        placeholder={required ? "Choose a teacher" : "No teacher in charge"}
        searchable
        onChange={e => setTeacherId(e.target.value)}
      />
    );

  return (
    <div className="cover-editor">
      <RadioGroup aria-label="How the period is covered" options={kinds} value={kind} onChange={setKind} />
      <div className="cover-editor-fields">
        {kind === "SUBSTITUTE" && (
          <>
            {teacherPicker("Teacher", true)}
            <Select
              label="Teaches"
              options={subjectOptions}
              value={subjectId}
              placeholder={`${item.subject.subjectName} (timetabled)`}
              onChange={e => setSubjectId(e.target.value)}
              disabled={candidates.isLoading}
            />
          </>
        )}
        {kind === "ACTIVITY" && (
          <>
            <Select label="Activity" required creatable options={activityOptions} value={activity} placeholder="Choose or type an activity" onChange={e => setActivity(e.target.value)} />
            {teacherPicker("Teacher in charge", false)}
          </>
        )}
        {kind !== "NOT_NEEDED" && (
          <TextInput label="Note" maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder={kind === "LEISURE" ? "Class monitor in charge" : "Revise chapter 4"} />
        )}
      </div>
      {candidates.error && <div className="small" style={{ color: "var(--danger-text)" }}>{message(candidates.error)}</div>}
      <div className="cover-editor-actions">
        <span className="footer-status" role={error ? "alert" : undefined}>
          {error}
        </span>
        <Button size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" loading={save.isPending} onClick={submit}>
          {plan ? "Save changes" : "Save"}
        </Button>
      </div>
    </div>
  );
}
