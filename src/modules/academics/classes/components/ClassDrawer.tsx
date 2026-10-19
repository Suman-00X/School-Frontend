import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList, useApiMutation, useForm } from "@/common/hooks";
import { Button, Drawer, Field, Textarea, useToast } from "@/common/ui";
import { CLASSES_PATH, updateClass, type ClassInput, type ClassLevel, type LevelRow, type SchoolClass } from "../api/classes";
import { SECTIONS_PATH } from "../api/sections";
import { LevelPicker } from "./LevelPicker";

type Values = { level: ClassLevel | ""; description: string };

/* Set the level of a class from before levels (level null), from its "Set level" button. It still
   handles a class with a level (level locked once it has sections) though nothing opens it for one.
   New classes come from "Add classes". Mount it when opened. */
export function ClassDrawer({
  open,
  klass,
  levels,
  onClose,
  onSaved
}: {
  open: boolean;
  klass: SchoolClass;
  levels: LevelRow[] | undefined;
  onClose: () => void;
  onSaved?: (saved: SchoolClass) => void;
}) {
  const toast = useToast();
  const { selected: year } = useAcademicYear();
  const form = useForm<Values>({ level: "", description: "" });
  const update = useApiMutation(updateClass, { invalidate: [CLASSES_PATH] });
  const { values, errors } = form;

  /* Sections in the header's year tell us the level is locked (the server also counts other years) */
  const sections = useApiList(SECTIONS_PATH, { classId: klass.id, limit: 1 }, { enabled: open && !!klass.level });
  const sectionCount = sections.meta?.total ?? 0;
  const locked = !!klass.level && sectionCount > 0;

  useEffect(() => {
    if (open) form.reset({ level: klass.level ?? "", description: klass.description ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, klass.id]);

  const legacy = !klass.level;

  let hint: string;
  if (legacy) hint = `"${klass.className}" was created before classes had levels. Pick the level it is.`;
  else if (locked)
    hint = `${klass.className} has ${sectionCount} section${sectionCount === 1 ? "" : "s"} in ${year?.yearName ?? "this year"}, so its level can't change.`;
  else hint = "The level can change only while the class has no sections in any year.";

  const onError = (err: unknown) => {
    /* "A class named Class 1 already exists", "Class 1 has 2 sections, so it cannot become Class 3…" */
    if (isApiError(err) && err.status === 409) {
      form.setErrors({ level: err.message });
      form.setFormError(null);
    } else form.setServerErrors(err, { className: "level" });
  };
  const onSuccess = (res: { data: SchoolClass; message: string }) => {
    toast.success(res.message);
    onSaved?.(res.data);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!values.level) return form.setErrors({ level: legacy ? "Pick the level this class is" : "Pick a level" });
    const description = values.description.trim();
    const patch: Partial<ClassInput> = {};
    if (values.level !== klass.level) patch.level = values.level;
    if (description !== (klass.description ?? "")) patch.description = description;
    if (!Object.keys(patch).length) return onClose();
    update.mutate({ id: klass.id, ...patch }, { onSuccess, onError });
  };

  const title = legacy ? `Set a level for ${klass.className}` : `Edit ${klass.className}`;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Classes are school-wide and carry over to every year."
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="class-form"
            variant="primary"
            loading={update.isPending}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form id="class-form" className="stack" onSubmit={submit} noValidate>
        <Field label="Level" required hint={hint} error={errors.level}>
          <LevelPicker
            label="Level"
            mode="one"
            levels={levels}
            own={klass.level}
            disabled={locked}
            value={values.level ? [values.level] : []}
            onChange={([level]) => form.set("level", level ?? "")}
          />
        </Field>
        <Textarea label="Description" hint="Optional" rows={2} maxLength={1000} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
