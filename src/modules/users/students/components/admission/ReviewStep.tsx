import { Pencil } from "lucide-react";
import type { AcademicYear } from "@/common/api";
import { Badge, Button, Card, DescriptionList, EmptyState } from "@/common/ui";
import { enumLabel, formatDate, fullName } from "@/common/utils/format";
import type { PersonValues } from "@/modules/users/shared";
import type { StudentProfileValues } from "../../api/students";
import { sectionLabel, useClasses, useSections } from "../../api/placement";
import { cardName, type EnrollmentValues, type ParentCard } from "./state";

export function ReviewStep({
  person,
  profile,
  cards,
  enrollment,
  years,
  onEdit
}: {
  person: PersonValues;
  profile: StudentProfileValues;
  cards: ParentCard[];
  enrollment: EnrollmentValues;
  years: AcademicYear[];
  onEdit: (step: number) => void;
}) {
  const classes = useClasses();
  const sections = useSections(enrollment.classId, enrollment.academicYearId);
  const section = sections.data?.rows.find(s => s.id === enrollment.sectionId);
  const edit = (step: number) => (
    <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => onEdit(step)}>
      Edit
    </Button>
  );

  return (
    <div className="stack">
      <Card title="Student" actions={edit(0)}>
        <DescriptionList
          columns={3}
          items={[
            { label: "Name", value: fullName(person, true) },
            { label: "Email", value: person.email },
            { label: "Phone", value: person.phone },
            { label: "Gender", value: enumLabel(person.gender) },
            { label: "Date of birth", value: formatDate(person.dob) },
            { label: "Admission number", value: <span className="muted">Generated on admission</span> },
            { label: "Admission date", value: formatDate(profile.admissionDate) },
            { label: "Blood group", value: profile.bloodGroup },
            { label: "Category", value: profile.category },
            { label: "Religion", value: profile.religion },
            { label: "Mother tongue", value: profile.motherTongue, hidden: !profile.motherTongue },
            { label: "PEN (UDISE+)", value: profile.pen, hidden: !profile.pen },
            { label: "APAAR id", value: profile.apaarId, hidden: !profile.apaarId },
            { label: "APAAR consent given on", value: profile.apaarConsentOn, hidden: !profile.apaarConsentOn },
            { label: "Address", value: person.address, wide: true },
            { label: "Notes", value: profile.description, wide: true, hidden: !profile.description }
          ]}
        />
      </Card>
      <Card title="Parents" actions={edit(1)}>
        {cards.length === 0 ? (
          <EmptyState title="No parents" message="They can be linked later from the student's profile." />
        ) : (
          <div className="stack-sm">
            {cards.map(c => (
              <div key={c.key} className="row" style={{ gap: 8 }}>
                <strong>{cardName(c)}</strong>
                <span>{enumLabel(c.relation)}</span>
                <Badge tone={c.mode === "new" ? "info" : "neutral"}>{c.mode === "new" ? "New account" : "Existing"}</Badge>
                {c.isPrimaryContact && <Badge tone="primary">Primary contact</Badge>}
                <span className="muted small">{c.mode === "new" ? c.person.email : c.parent?.user.email}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Enrollment" actions={edit(2)}>
        <DescriptionList
          columns={3}
          items={[
            { label: "Academic year", value: years.find(y => y.id === enrollment.academicYearId)?.yearName },
            { label: "Section", value: section ? sectionLabel(section, classes.data) : null },
            { label: "Admission type", value: enumLabel(enrollment.admissionType) }
          ]}
        />
      </Card>
    </div>
  );
}
