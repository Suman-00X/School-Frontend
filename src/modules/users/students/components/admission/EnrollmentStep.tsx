import { Link } from "react-router-dom";
import type { AcademicYear } from "@/common/api";
import { Select } from "@/common/ui";
import { enumOptions } from "@/common/utils/format";
import { ADMISSION_TYPES } from "../../api/students";
import { useClasses, useSections } from "../../api/placement";
import type { EnrollmentValues } from "./state";

/* Year → class → section (fetched for the chosen year) + admission type */
export function EnrollmentStep({
  years,
  values,
  errors,
  onChange
}: {
  years: AcademicYear[];
  values: EnrollmentValues;
  errors: Record<string, string>;
  onChange: (change: Partial<EnrollmentValues>) => void;
}) {
  const classes = useClasses();
  const sections = useSections(values.classId || null, values.academicYearId, !!values.classId && !!values.academicYearId);
  const sectionRows = sections.data?.rows ?? [];

  return (
    <div className="stack">
      <div className="form-grid">
        <Select
          label="Academic year"
          required
          options={years.map(y => ({ value: y.id, label: y.yearName + (y.isCurrent ? " (current)" : "") }))}
          value={values.academicYearId}
          error={errors.academicYearId}
          onChange={e => onChange({ academicYearId: e.target.value, sectionId: "" })}
        />
        <Select
          label="Admission type"
          options={enumOptions(ADMISSION_TYPES)}
          value={values.admissionType}
          error={errors.admissionType}
          onChange={e => onChange({ admissionType: e.target.value })}
        />
        <Select
          label="Class"
          required
          placeholder={classes.isLoading ? "Loading…" : "Choose a class"}
          options={(classes.data ?? []).map(c => ({ value: c.id, label: c.className }))}
          value={values.classId}
          error={errors.classId}
          onChange={e => onChange({ classId: e.target.value, sectionId: "" })}
        />
        <Select
          label="Section"
          required
          disabled={!values.classId || sections.isLoading}
          placeholder={sections.isLoading ? "Loading…" : values.classId && !sectionRows.length ? "No sections in this year" : "Choose a section"}
          options={sectionRows.map(s => ({
            value: s.id,
            label: [s.sectionName, s.capacity && `capacity ${s.capacity}`, s.classTeacher && `class teacher ${s.classTeacher.employeeCode}`].filter(Boolean).join(" · ")
          }))}
          value={values.sectionId}
          error={errors.sectionId}
          /* In the field's reserved line, not a banner that appears under the form */
          hint={
            values.classId && sections.data && !sectionRows.length ? (
              <span style={{ color: "var(--warning-text)" }}>
                No sections in this year. <Link to="/academics/classes">Add them in Academics setup</Link>
              </span>
            ) : undefined
          }
          onChange={e => onChange({ sectionId: e.target.value })}
        />
      </div>
      <div className="small muted">The roll number is generated in the section when the student is admitted.</div>
    </div>
  );
}
