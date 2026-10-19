import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Mail, Pencil, Phone, UserCog } from "lucide-react";
import { useAuth } from "@/common/auth";
import { Avatar, Badge, Button, ButtonLink, Card, ErrorState, Page, PageHeader, SkeletonBlock, Tabs, useTabParam, type TabItem } from "@/common/ui";
import { fullName } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import { useStudent, type Student } from "../api/students";
import { useFileLink, useStudentFiles } from "../api/records";
import { EditStudentDrawer } from "../components/EditStudentDrawer";
import { OverviewTab } from "../components/OverviewTab";
import { ParentsTab } from "../components/ParentsTab";
import { DocumentsTab } from "../components/DocumentsTab";
import { FeesTab } from "../components/FeesTab";
import { AttendanceTab } from "../components/AttendanceTab";
import { ResultsTab } from "../components/ResultsTab";

/* PE-02: header with photo and actions, then one tab per permission */
export default function StudentProfilePage() {
  const { studentId = "" } = useParams();
  const { can } = useAuth();
  const student = useStudent(studentId);
  /* Tabs whose read came back 403 (e.g. results for a teacher who isn't the class teacher) */
  const [refused, setRefused] = useState<Set<string>>(new Set());
  const refuse = useCallback((id: string) => setRefused(r => (r.has(id) ? r : new Set(r).add(id))), []);
  const hideFees = useCallback(() => refuse("fees"), [refuse]);
  const hideAttendance = useCallback(() => refuse("attendance"), [refuse]);
  const hideResults = useCallback(() => refuse("results"), [refuse]);

  const tabs: TabItem[] = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "parents", label: "Parents", hidden: !can("users.students.readParents") },
      { id: "documents", label: "Documents", hidden: !can("files.documents.read") },
      { id: "fees", label: "Fees", hidden: !can("finance.invoices.read") || refused.has("fees") },
      { id: "attendance", label: "Attendance", hidden: !can("academics.attendance.read") || refused.has("attendance") },
      { id: "results", label: "Results", hidden: !can("academics.reportCards.read") || refused.has("results") }
    ],
    [can, refused]
  );
  const [tab, setTab] = useTabParam(tabs);

  if (student.isLoading)
    return (
      <Page>
        <SkeletonBlock lines={8} />
      </Page>
    );
  if (student.error || !student.data)
    return (
      <Page>
        <ErrorState error={student.error} onRetry={() => void student.refetch()} />
      </Page>
    );

  const s = student.data;
  return (
    <Page>
      <PageHeader title={fullName(s.user)} breadcrumbs={[{ label: "Students", to: "/users/students" }, { label: fullName(s.user) }]} />
      <ProfileHeader student={s} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div style={{ marginTop: 16 }}>
        {tab === "overview" && <OverviewTab student={s} />}
        {tab === "parents" && <ParentsTab student={s} />}
        {tab === "documents" && <DocumentsTab student={s} />}
        {tab === "fees" && <FeesTab studentId={s.id} onForbidden={hideFees} />}
        {tab === "attendance" && <AttendanceTab studentId={s.id} onForbidden={hideAttendance} />}
        {tab === "results" && <ResultsTab studentId={s.id} onForbidden={hideResults} />}
      </div>
    </Page>
  );
}

function ProfileHeader({ student: s }: { student: Student }) {
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  /* Photo: the newest PHOTO file (the list is newest first) */
  const files = useStudentFiles(s.id, can("files.documents.read"));
  const photo = files.data?.find(f => f.category === "PHOTO");
  const photoLink = useFileLink(photo?.id);
  const name = fullName(s.user);

  return (
    <Card>
      <div className="row-between" style={{ alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 16, alignItems: "center", flexWrap: "nowrap", minWidth: 0 }}>
          <Avatar name={name} src={photoLink.data?.url} size="lg" />
          <div className="stack-sm" style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 8 }}>
              <Badge tone="primary">
                <span className="mono">{s.studentCode}</span>
              </Badge>
              <Badge>Admission no. {s.admissionNumber}</Badge>
            </div>
            <div className="row small muted" style={{ gap: 14 }}>
              <span className="row" style={{ gap: 4 }}>
                <Mail size={14} /> {s.user.email}
              </span>
              {s.user.phone && (
                <span className="row" style={{ gap: 4 }}>
                  <Phone size={14} /> {s.user.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="row">
          {can("users.accounts.update") && (
            <ButtonLink to={`/users/${s.userId}`} icon={<UserCog />}>
              Edit account
            </ButtonLink>
          )}
          <InviteButton userIds={[s.userId]} names={{ [s.userId]: name }} />
          {can("users.students.update") && (
            <Button variant="primary" icon={<Pencil />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>
      {editing && <EditStudentDrawer student={s} onClose={() => setEditing(false)} />}
    </Card>
  );
}
