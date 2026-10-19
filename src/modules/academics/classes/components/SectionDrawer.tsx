import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, DescriptionList, Drawer, Select, TextInput, Textarea, useToast } from "@/common/ui";
import type { SchoolClass } from "../api/classes";
import { createSection, SECTIONS_PATH, updateSection, useTeacherOptions, type Section, type SectionInput } from "../api/sections";

type Values = {
  classId: string;
  sectionName: string;
  capacity: string;
  classTeacherId: string;
  deputyClassTeacherId: string;
  description: string;
};

const SECTION_NAME = /^[A-Z0-9]{1,5}$/;

const toValues = (s: Section): Values => ({
  classId: s.classId,
  sectionName: s.sectionName,
  capacity: s.capacity === null ? "" : String(s.capacity),
  classTeacherId: s.classTeacherId ?? "",
  deputyClassTeacherId: s.deputyClassTeacherId ?? "",
  description: s.description ?? ""
});

/* The 422s name the field they are about */
const FIELD_OF_422: [RegExp, keyof Values][] = [
  [/^classId|class does not exist|class is no longer/i, "classId"],
  [/^deputyClassTeacherId|deputy/i, "deputyClassTeacherId"],
  [/^classTeacherId/i, "classTeacherId"]
];

/* Create (section = null, in the selected class) or view/edit a section of the header's year */
export function SectionDrawer({
  open,
  section,
  classes,
  defaultClassId,
  yearName,
  canEdit,
  onClose
}: {
  open: boolean;
  section: Section | null;
  classes: SchoolClass[];
  defaultClassId: string;
  yearName: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const teachers = useTeacherOptions();
  const form = useForm<Values>({ classId: "", sectionName: "", capacity: "", classTeacherId: "", deputyClassTeacherId: "", description: "" });
  const create = useApiMutation(createSection, { invalidate: [SECTIONS_PATH] });
  const update = useApiMutation(updateSection, { invalidate: [SECTIONS_PATH] });
  const { values } = form;

  useEffect(() => {
    if (open)
      form.reset(
        section
          ? toValues(section)
          : { classId: defaultClassId, sectionName: "", capacity: "", classTeacherId: "", deputyClassTeacherId: "", description: "" }
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, section?.id]);

  const title = section ? `${section.class.className} – ${section.sectionName}` : "New section";
  const subtitle = `Academic year ${yearName}`;

  if (section && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={title} subtitle={subtitle}>
        <DescriptionList
          columns={1}
          items={[
            { label: "Class", value: section.class.className },
            { label: "Section", value: section.sectionName },
            { label: "Capacity", value: section.capacity },
            { label: "Class teacher", value: teachers.label(section.classTeacher) },
            { label: "Deputy class teacher", value: teachers.label(section.deputyClassTeacher) },
            { label: "Description", value: section.description }
          ]}
        />
      </Drawer>
    );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.classId) e.classId = "Pick a class";
    if (!SECTION_NAME.test(values.sectionName.trim().toUpperCase())) e.sectionName = "1 to 5 letters or digits, e.g. A";
    if (values.capacity) {
      const n = Number(values.capacity);
      if (!Number.isInteger(n) || n < 1 || n > 500) e.capacity = "A whole number from 1 to 500";
    } else if (section?.capacity !== null && section?.capacity !== undefined)
      e.capacity = "Capacity can't be removed once set. Enter a number.";
    form.setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onError = (err: unknown) => {
    /* "Section A already exists in this class for this academic year" */
    if (isApiError(err) && err.status === 409 && /already exists/i.test(err.message)) {
      form.setErrors({ sectionName: err.message });
      return form.setFormError(null);
    }
    if (isApiError(err) && err.status === 422) {
      const field = FIELD_OF_422.find(([re]) => re.test(err.message))?.[1];
      if (field) {
        form.setErrors({ [field]: err.message });
        return form.setFormError(null);
      }
    }
    form.setServerErrors(err);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const now = {
      classId: values.classId,
      sectionName: values.sectionName.trim().toUpperCase(),
      capacity: values.capacity ? Number(values.capacity) : undefined,
      classTeacherId: values.classTeacherId || undefined,
      deputyClassTeacherId: values.deputyClassTeacherId || null,
      description: values.description.trim()
    };
    const onSuccess = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };

    if (!section) {
      const body: SectionInput = { classId: now.classId, sectionName: now.sectionName };
      if (now.capacity !== undefined) body.capacity = now.capacity;
      if (now.classTeacherId) body.classTeacherId = now.classTeacherId;
      if (now.deputyClassTeacherId) body.deputyClassTeacherId = now.deputyClassTeacherId;
      if (now.description) body.description = now.description;
      return create.mutate(body, { onSuccess, onError });
    }

    const patch: Partial<SectionInput> = {};
    if (now.classId !== section.classId) patch.classId = now.classId;
    if (now.sectionName !== section.sectionName) patch.sectionName = now.sectionName;
    if (now.capacity !== undefined && now.capacity !== section.capacity) patch.capacity = now.capacity;
    if (now.classTeacherId && now.classTeacherId !== section.classTeacherId) patch.classTeacherId = now.classTeacherId;
    if (now.deputyClassTeacherId !== section.deputyClassTeacherId) patch.deputyClassTeacherId = now.deputyClassTeacherId;
    if (now.description !== (section.description ?? "")) patch.description = now.description;
    if (!Object.keys(patch).length) return onClose();
    update.mutate({ id: section.id, ...patch }, { onSuccess, onError });
  };

  /* The API can't unset a class teacher once set, only change it */
  const teacherPlaceholder = section?.classTeacherId ? undefined : "Not set";
  const deputyOptions = teachers.options.filter(o => o.value !== values.classTeacherId);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="section-form" variant="primary" loading={create.isPending || update.isPending}>
            {section ? "Save changes" : "Create section"}
          </Button>
        </>
      }
    >
      <form id="section-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <Select
            label="Class"
            required
            placeholder={values.classId ? undefined : "Pick a class"}
            options={classes.map(c => ({ value: c.id, label: c.className }))}
            {...form.text("classId")}
          />
          <TextInput
            label="Section"
            required
            maxLength={5}
            placeholder="A"
            autoFocus={!section}
            autoCapitalize="characters"
            hint="1 to 5 letters or digits"
            {...form.text("sectionName")}
            onChange={e => form.set("sectionName", e.target.value.toUpperCase())}
          />
          <TextInput label="Capacity" type="number" min={1} max={500} hint="Optional, up to 500. Not enforced." {...form.text("capacity")} />
        </div>
        {teachers.enabled ? (
          <div className="form-grid">
            <Select
              label="Class teacher"
              placeholder={teacherPlaceholder}
              options={teachers.options}
              disabled={teachers.isLoading}
              {...form.text("classTeacherId")}
              onChange={e => {
                form.set("classTeacherId", e.target.value);
                if (e.target.value && e.target.value === values.deputyClassTeacherId) form.set("deputyClassTeacherId", "");
              }}
            />
            <Select
              label="Deputy class teacher"
              placeholder="None"
              options={deputyOptions}
              disabled={teachers.isLoading}
              hint="Takes the daily register when the class teacher is away"
              {...form.text("deputyClassTeacherId")}
            />
          </div>
        ) : (
          section && (
            <DescriptionList
              items={[
                { label: "Class teacher", value: teachers.label(section.classTeacher) },
                { label: "Deputy class teacher", value: teachers.label(section.deputyClassTeacher) }
              ]}
            />
          )
        )}
        <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
