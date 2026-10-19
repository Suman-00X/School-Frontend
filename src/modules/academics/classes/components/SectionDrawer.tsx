import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ListOrdered } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, ButtonLink, DescriptionList, Drawer, Select, Tabs, TextInput, Textarea, useToast, type TabItem } from "@/common/ui";
import { useMyTeaching } from "../../shared/api/teaching";
import type { SchoolClass } from "../api/classes";
import { SECTIONS_PATH, updateSection, useTeacherOptions, type Section, type SectionInput } from "../api/sections";
import { RollNumbersDialog } from "./RollNumbersDialog";
import { sectionLinks, SectionStudentsTab, SectionSubjectsTab, SectionTeachersTab, SectionTimetableTab } from "./SectionTabs";

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

/* View or edit a section of the header's year, with its subjects, teachers, students and week as
   read-only tabs (each links to its own page for changes). New sections come from "Add sections".
   Mount it when opened. */
export function SectionDrawer({
  open,
  section,
  classes,
  yearName,
  canEdit,
  onClose
}: {
  open: boolean;
  section: Section;
  classes: SchoolClass[];
  yearName: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const teaching = useMyTeaching();
  const teachers = useTeacherOptions();
  const [tab, setTab] = useState("details");
  const [renumbering, setRenumbering] = useState(false);
  const form = useForm<Values>({ classId: "", sectionName: "", capacity: "", classTeacherId: "", deputyClassTeacherId: "", description: "" });
  const update = useApiMutation(updateSection, { invalidate: [SECTIONS_PATH] });
  const { values } = form;

  useEffect(() => {
    if (open) form.reset(toValues(section));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, section.id]);

  const title = `${section.class.className} – ${section.sectionName}`;
  const subtitle = `Academic year ${yearName}`;
  const label = `${section.class.className}-${section.sectionName}`;
  const links = sectionLinks(section.id);

  const tabs: TabItem[] = [
    { id: "details", label: "Details" },
    { id: "subjects", label: "Subjects", hidden: !can("academics.sectionSubjects.read") },
    { id: "teachers", label: "Teachers", hidden: !can("academics.teacherAssignments.read") || !can("academics.sectionSubjects.read") },
    { id: "students", label: "Students", hidden: !can("academics.enrollments.read") },
    /* A teacher sees a section's week only as its class teacher or deputy */
    { id: "timetable", label: "Timetable", hidden: !can("academics.timetable.read") || !teaching.leads(section.id) }
  ];
  const shown = tabs.some(t => t.id === tab && !t.hidden) ? tab : "details";

  /* Changes are made on each tab's own page: the footer links there */
  const manage = (permission: string) => can(permission) && !readOnly;
  const tabFooter: Record<string, ReactNode> = {
    subjects: (
      <ButtonLink to={links.subjects} variant={manage("academics.sectionSubjects.create") ? "primary" : "default"}>
        {manage("academics.sectionSubjects.create") ? "Add or remove subjects" : "Open in Subjects"}
      </ButtonLink>
    ),
    teachers: (
      <ButtonLink to={links.teachers} variant={manage("academics.teacherAssignments.create") ? "primary" : "default"}>
        {manage("academics.teacherAssignments.create") ? "Assign teachers" : "Open in Teacher assignments"}
      </ButtonLink>
    ),
    students: (
      <>
        {manage("academics.enrollments.assignRollNumbers") && (
          <Button icon={<ListOrdered />} onClick={() => setRenumbering(true)}>
            Renumber roll numbers
          </Button>
        )}
        <ButtonLink to={links.roster} variant="primary">
          Open roster
        </ButtonLink>
      </>
    ),
    timetable: (
      <ButtonLink to={links.timetable} variant={manage("academics.timetable.manage") ? "primary" : "default"}>
        {manage("academics.timetable.manage") ? "Edit timetable" : "Open in Timetable"}
      </ButtonLink>
    )
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.classId) e.classId = "Pick a class";
    if (!SECTION_NAME.test(values.sectionName.trim().toUpperCase())) e.sectionName = "1 to 5 letters or digits, e.g. A";
    if (values.capacity) {
      const n = Number(values.capacity);
      if (!Number.isInteger(n) || n < 1 || n > 500) e.capacity = "A whole number from 1 to 500";
    } else if (section.capacity !== null)
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
  const teacherPlaceholder = section.classTeacherId ? undefined : "Not set";
  const deputyOptions = teachers.options.filter(o => o.value !== values.classTeacherId);

  const readOnlyDetails = (
    <DescriptionList
      items={[
        { label: "Class", value: section.class.className },
        { label: "Section", value: section.sectionName },
        { label: "Capacity", value: section.capacity },
        { label: "Class teacher", value: teachers.label(section.classTeacher) },
        { label: "Deputy class teacher", value: teachers.label(section.deputyClassTeacher) },
        { label: "Description", value: section.description, wide: true }
      ]}
    />
  );

  const editForm = (
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
        <DescriptionList
          items={[
            { label: "Class teacher", value: teachers.label(section.classTeacher) },
            { label: "Deputy class teacher", value: teachers.label(section.deputyClassTeacher) }
          ]}
        />
      )}
      <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
    </form>
  );

  /* Edits typed on Details are kept while another tab is open */
  const footer =
    shown === "details"
      ? canEdit && (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" form="section-form" variant="primary" loading={update.isPending}>
              Save changes
            </Button>
          </>
        )
      : tabFooter[shown];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={title}
      subtitle={subtitle}
      footerStatus={shown === "details" ? form.formError : undefined}
      footer={footer || undefined}
    >
      <div className="stack">
        <div className="section-drawer-tabs">
          <Tabs tabs={tabs} value={shown} onChange={setTab} />
        </div>
        {shown === "details" && (canEdit ? editForm : readOnlyDetails)}
        {shown === "subjects" && <SectionSubjectsTab section={section} />}
        {shown === "teachers" && <SectionTeachersTab section={section} />}
        {shown === "students" && <SectionStudentsTab section={section} />}
        {shown === "timetable" && <SectionTimetableTab section={section} />}
      </div>
      {renumbering && <RollNumbersDialog target={{ sectionId: section.id }} label={label} onClose={() => setRenumbering(false)} />}
    </Drawer>
  );
}
