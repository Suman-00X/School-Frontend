import { useState } from "react";
import { useParams } from "react-router-dom";
import { Mail, Pencil, Phone, UserCog } from "lucide-react";
import { useAuth } from "@/common/auth";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Badge, Button, ButtonLink, ErrorState, Page, SkeletonBlock, useTabParam, type TabItem } from "@/common/ui";
import { fullName } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import { DrillName, RecordHeader } from "@/modules/users/shared";
import { useStudent, type Student } from "../api/students";
import { useFileLink, useStudentFiles } from "../api/records";
import { EditStudentDrawer } from "../components/EditStudentDrawer";
import { OverviewTab } from "../components/OverviewTab";
import { ParentsTab } from "../components/ParentsTab";
import { DocumentsTab } from "../components/DocumentsTab";
import { FeesTab } from "../components/FeesTab";
import { AttendanceTab } from "../components/AttendanceTab";
import { ResultsTab } from "../components/ResultsTab";

/* PE-02: drill-in header (name + one tab per permission), a header card with the key facts and
   actions, then the open tab. Tabs depend on permissions only, so they are all there at once;
   a tab whose read is refused says so in place. */
export default function StudentProfilePage() {
  const { studentId = "" } = useParams();
  const { can } = useAuth();
  const student = useStudent(studentId);

  const tabs: TabItem[] = [
    { id: "overview", label: "Overview" },
    { id: "parents", label: "Parents", hidden: !can("users.students.readParents") },
    { id: "documents", label: "Documents", hidden: !can("files.documents.read") },
    { id: "fees", label: "Fees", hidden: !can("finance.invoices.read") },
    { id: "attendance", label: "Attendance", hidden: !can("academics.attendance.read") },
    { id: "results", label: "Results", hidden: !can("academics.reportCards.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);

  const s = student.data;
  const header = (
    <DrillHeader back="/users/students" backLabel="Back to students" title={<DrillName name={s ? fullName(s.user) : ""} />} tabs={tabs} value={tab} onChange={setTab} />
  );

  if (student.error || (!student.isLoading && !s))
    return (
      <Page>
        {header}
        <ErrorState error={student.error} onRetry={() => void student.refetch()} />
      </Page>
    );

  return (
    <Page>
      {header}
      <ProfileHeader student={s} />
      {!s ? (
        <SkeletonBlock lines={8} />
      ) : (
        <>
          {tab === "overview" && <OverviewTab student={s} />}
          {tab === "parents" && <ParentsTab student={s} />}
          {tab === "documents" && <DocumentsTab student={s} />}
          {tab === "fees" && <FeesTab studentId={s.id} />}
          {tab === "attendance" && <AttendanceTab studentId={s.id} />}
          {tab === "results" && <ResultsTab studentId={s.id} />}
        </>
      )}
    </Page>
  );
}

function ProfileHeader({ student: s }: { student: Student | undefined }) {
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  /* Photo: the newest PHOTO file (the list is newest first). It fills the avatar's fixed circle. */
  const files = useStudentFiles(s?.id ?? "", !!s && can("files.documents.read"));
  const photo = files.data?.find(f => f.category === "PHOTO");
  const photoLink = useFileLink(photo?.id);
  const name = s ? fullName(s.user) : "";

  return (
    <>
      <RecordHeader
        loading={!s}
        name={name}
        photo={photoLink.data?.url}
        facts={
          s && (
            <>
              <Badge tone="primary">
                <span className="mono">{s.studentCode}</span>
              </Badge>
              <Badge>Admission no. {s.admissionNumber}</Badge>
            </>
          )
        }
        contact={
          s && (
            <>
              <span className="row" style={{ gap: 4 }}>
                <Mail size={14} /> {s.user.email}
              </span>
              {s.user.phone && (
                <span className="row" style={{ gap: 4 }}>
                  <Phone size={14} /> {s.user.phone}
                </span>
              )}
            </>
          )
        }
        actions={
          <>
            {can("users.accounts.update") && (
              <ButtonLink to={s ? `/users/${s.userId}` : "#"} icon={<UserCog />} aria-disabled={!s || undefined}>
                Edit account
              </ButtonLink>
            )}
            <InviteButton userIds={s ? [s.userId] : []} names={s ? { [s.userId]: name } : {}} />
            {can("users.students.update") && (
              <Button variant="primary" icon={<Pencil />} disabled={!s} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </>
        }
      />
      {editing && s && <EditStudentDrawer student={s} onClose={() => setEditing(false)} />}
    </>
  );
}
