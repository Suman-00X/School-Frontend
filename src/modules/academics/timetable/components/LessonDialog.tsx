import { useEffect, useState, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Dialog, Select, TextInput, useConfirm, useToast } from "@/common/ui";
import { useTeacherOptions } from "../../classes/api/sections";
import {
  createSlot,
  deleteSlot,
  hhmm,
  TIMETABLE_INVALIDATE,
  updateSlot,
  useSectionAssignments,
  useSectionSubjects,
  type GridDay,
  type GridPeriod,
  type GridSlot,
  type SlotInput
} from "../api/timetable";
import { cellKey } from "./TimetableGrid";

type Values = { subjectId: string; teacherId: string; room: string; weekday: string; periodId: string };

export type LessonTarget = { day: GridDay; period: GridPeriod; slot: GridSlot | null };

const teacherName = (t: { user: { firstName: string; lastName: string } } | null | undefined) => (t ? `${t.user.firstName} ${t.user.lastName}` : "");

/* AC-07 cell popover: place a lesson in an empty cell, or change / clear a placed one.
   The teacher defaults to the subject's assigned teacher; pick another only for an exception.
   Clashes (409) and rule refusals (422) are reported to the grid, which shows them on the cell. */
export function LessonDialog({
  sectionId,
  sectionName,
  target,
  days,
  periods,
  onClose,
  onCellError
}: {
  sectionId: string;
  sectionName: string;
  target: LessonTarget | null;
  days: GridDay[];
  periods: GridPeriod[];
  onClose: () => void;
  /* message null: the cell's error is cleared */
  onCellError: (key: string, message: string | null) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const subjects = useSectionSubjects(sectionId);
  const assignments = useSectionAssignments(sectionId);
  const teachers = useTeacherOptions();
  const form = useForm<Values>({ subjectId: "", teacherId: "", room: "", weekday: "", periodId: "" });
  const [busy, setBusy] = useState(false);
  const create = useApiMutation(createSlot, { invalidate: TIMETABLE_INVALIDATE });
  const update = useApiMutation(updateSlot, { invalidate: TIMETABLE_INVALIDATE });
  const remove = useApiMutation(deleteSlot, { invalidate: TIMETABLE_INVALIDATE });
  const { values } = form;
  const slot = target?.slot ?? null;

  const assignedTo = (subjectId: string) => assignments.data?.find(a => a.subjectId === subjectId) ?? null;

  useEffect(() => {
    if (!target) return;
    const s = target.slot;
    /* The assigned teacher shows as the default (empty), any other as an exception */
    const assigned = s?.subject ? assignedTo(s.subject.id)?.teacherId : undefined;
    form.reset({
      subjectId: s?.subject?.id ?? "",
      teacherId: s?.teacher && s.teacher.id !== assigned ? s.teacher.id : "",
      room: s?.room ?? "",
      weekday: String(target.day.weekday),
      periodId: target.period.id
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, assignments.data]);

  if (!target) return null;
  const { day, period } = target;
  const key = cellKey(day.weekday, period.id);
  const assignment = values.subjectId ? assignedTo(values.subjectId) : null;
  const where = `${day.name} ${period.name} (${hhmm(period.startTime)}–${hhmm(period.endTime)})`;

  /* 409 clashes and 422 rule refusals go on the cell word for word; field problems on the fields */
  const fail = (err: unknown, at = key) => {
    if (isApiError(err) && err.isValidation) return form.setServerErrors(err);
    const message = isApiError(err) ? err.message : "Something went wrong. Please try again.";
    onCellError(at, message);
    form.setFormError(message);
  };

  const done = (message: string, at = key) => {
    toast.success(message);
    onCellError(key, null);
    if (at !== key) onCellError(at, null);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!values.subjectId) return form.setErrors({ subjectId: "Pick the subject" });
    const room = values.room.trim();
    /* Teacher: the exception picked, else the subject's assigned teacher (the server's default) */
    const teacherId = values.teacherId || assignment?.teacherId || undefined;
    const weekday = Number(values.weekday);
    const at = cellKey(weekday, values.periodId);
    setBusy(true);
    try {
      if (!slot) {
        const body: SlotInput = { sectionId, weekday: day.weekday, periodId: period.id, subjectId: values.subjectId };
        if (values.teacherId) body.teacherId = values.teacherId;
        if (room) body.room = room;
        const res = await create.mutateAsync(body);
        return done(res.message);
      }
      const patch: Partial<Omit<SlotInput, "sectionId">> = {};
      if (values.subjectId !== slot.subject?.id) patch.subjectId = values.subjectId;
      if (teacherId && teacherId !== slot.teacher?.id) patch.teacherId = teacherId;
      if (weekday !== day.weekday) patch.weekday = weekday;
      if (values.periodId !== period.id) patch.periodId = values.periodId;
      if (room && room !== slot.room) patch.room = room;
      if (!room && slot.room) {
        /* The API can't clear a room: place the lesson again without one (and put it back if that fails) */
        await remove.mutateAsync(slot.id);
        try {
          const res = await create.mutateAsync({ sectionId, weekday, periodId: values.periodId, subjectId: values.subjectId, ...(teacherId && { teacherId }) });
          return done(res.message, at);
        } catch (err) {
          await create
            .mutateAsync({ sectionId, weekday: day.weekday, periodId: period.id, subjectId: slot.subject!.id, ...(slot.teacher && { teacherId: slot.teacher.id }), room: slot.room! })
            .catch(() => undefined);
          throw err;
        }
      }
      if (!Object.keys(patch).length) return onClose();
      const res = await update.mutateAsync({ id: slot.id, ...patch });
      done(res.message, at);
    } catch (err) {
      fail(err, at);
    } finally {
      setBusy(false);
    }
  };

  const askClear = async () => {
    if (!slot) return;
    const ok = await confirm({
      title: `Clear ${where}?`,
      message: `${slot.subject?.subjectName ?? "The lesson"}${slot.teacher ? ` with ${slot.teacher.name}` : ""} is taken off ${sectionName}'s timetable on ${day.name}s.`,
      confirmLabel: "Clear lesson"
    });
    if (!ok) return;
    remove.mutate(slot.id, { onSuccess: res => done(res.message), onError: err => fail(err) });
  };

  const subjectOptions = (subjects.data ?? []).map(s => {
    const a = assignedTo(s.subjectId);
    return { value: s.subjectId, label: s.subject.subjectName, description: a ? teacherName(a.teacher) : "No teacher assigned" };
  });
  const lessonPeriods = periods.filter(p => !p.isBreak);

  return (
    <Dialog
      open
      onClose={onClose}
      title={slot ? `${sectionName} · ${where}` : `Add a lesson · ${where}`}
      footerStatus={form.formError}
      footer={
        <>
          {slot && (
            <Button variant="ghost" onClick={() => void askClear()} disabled={busy} loading={remove.isPending && !busy}>
              Clear
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="lesson-form" loading={busy}>
            {slot ? "Save" : "Add lesson"}
          </Button>
        </>
      }
    >
      <form id="lesson-form" className="stack" onSubmit={e => void submit(e)} noValidate>
        <Select
          label="Subject"
          required
          {...form.text("subjectId")}
          options={subjectOptions}
          placeholder={subjects.isLoading ? "Loading subjects…" : "Pick a subject"}
          hint={subjects.data && !subjects.data.length ? "No subjects are taught in this section yet. Add them under Setup › Subjects." : undefined}
        />
        {teachers.enabled && (
          <Select
            label="Teacher"
            {...form.text("teacherId")}
            options={teachers.options}
            placeholder={assignment ? `${teacherName(assignment.teacher)} (assigned)` : "Pick a teacher"}
            hint={
              assignment
                ? "Leave it on the assigned teacher; pick another only for an exception."
                : values.subjectId
                  ? "No teacher is assigned to this subject in the section: pick one."
                  : "Defaults to the subject's assigned teacher."
            }
          />
        )}
        <TextInput label="Room" maxLength={30} {...form.text("room")} placeholder="Optional, e.g. Lab 1" hint="Two lessons can't share a room at the same time." />
        {slot && (
          <div className="form-grid">
            <Select label="Day" required {...form.text("weekday")} options={days.map(d => ({ value: String(d.weekday), label: d.name }))} />
            <Select
              label="Period"
              required
              {...form.text("periodId")}
              options={lessonPeriods.map(p => ({ value: p.id, label: p.name, description: `${hhmm(p.startTime)}–${hhmm(p.endTime)}` }))}
            />
          </div>
        )}
      </form>
    </Dialog>
  );
}
