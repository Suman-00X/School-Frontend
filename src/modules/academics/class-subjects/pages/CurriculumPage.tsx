/* AC-03 + AC-04 · Curriculum (Academics › Setup): what each section is taught and by whom.
   Two tabs: section by section (subjects, teachers, classes a week), and one teacher's subjects. */
import { useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useListParams } from "@/common/hooks";
import { Button, Page, PageHeader, Tabs, useTabParam } from "@/common/ui";
import { useClassSectionPick } from "../../shared/components/ClassSectionPicker";
import { AssignTeacherDialog } from "../../teacher-assignments/components/AssignTeacherDialog";
import { ByTeacher, type AssignDialogState } from "../../teacher-assignments/components/ByTeacher";
import { SectionCurriculum } from "../components/SectionCurriculum";

export default function CurriculumPage() {
  const { can } = useAuth();
  const { selected: year, readOnly } = useAcademicYear();
  const tabs = [
    { id: "curriculum", label: "Curriculum", hidden: !can("academics.sectionSubjects.read") },
    { id: "teacher", label: "Teacher", hidden: !can("academics.teacherAssignments.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);
  const { params, setParams } = useListParams({ class: "", section: "", teacher: "" });
  const pick = useClassSectionPick(params.class, params.section);
  const [dialog, setDialog] = useState<AssignDialogState | null>(null);
  /* Assigning needs the teacher list, which only ADMIN, PRINCIPAL and STAFF can read */
  const canAssign = can("academics.teacherAssignments.create") && can("users.teachers.read") && !readOnly;
  const canRemove = can("academics.teacherAssignments.remove") && !readOnly;
  const yearName = year?.yearName ?? "the year chosen in the header";

  return (
    <Page>
      <PageHeader
        title="Curriculum"
        subtitle={
          tab === "teacher"
            ? `The subjects and sections each teacher teaches in ${yearName}`
            : `What each section is taught in ${yearName}, who teaches it and how many classes a week`
        }
        actions={
          tab === "teacher" &&
          canAssign && (
            <Button variant="primary" icon={<Plus />} onClick={() => setDialog({ teacherId: params.teacher || undefined })}>
              Assign a subject
            </Button>
          )
        }
      />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "teacher" ? (
        <ByTeacher teacherId={params.teacher} onTeacher={id => setParams({ teacher: id })} canAssign={canAssign} canRemove={canRemove} onDialog={setDialog} />
      ) : (
        <SectionCurriculum pick={pick} onPick={(classId, sectionId) => setParams({ class: classId, section: sectionId })} />
      )}
      {dialog && <AssignTeacherDialog {...dialog} onClose={() => setDialog(null)} />}
    </Page>
  );
}
