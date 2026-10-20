import { useEffect } from "react";
import { Outlet, useOutletContext, useParams } from "react-router-dom";
import { Users } from "lucide-react";
import { useAuth } from "@/common/auth";
import { SideNav } from "@/common/layout/SideNav";
import { EmptyState, ErrorState, Page, SkeletonBlock } from "@/common/ui";
import { studentPath, useMyStudents, type PortalStudent } from "../api/students";
import { useRememberedStudent } from "../hooks/useRememberedStudent";
import { ChildSwitcher } from "./ChildSwitcher";
import { NotLinked } from "./PortalError";
import "../portal.css";

export type PortalContext = { student: PortalStudent; students: PortalStudent[] };

/* The selected child, for pages inside the layout */
export const usePortalStudent = () => useOutletContext<PortalContext>();

/* My school › Student: the child switcher and the side list of the child's pages (PO-01…PO-08).
   The child is in the URL (/me/students/:studentId/…), so reloads and shared links keep it. */
export function PortalLayout() {
  const { studentId = "" } = useParams();
  const { can, canAny } = useAuth();
  const students = useMyStudents();
  const { remember } = useRememberedStudent();
  const student = students.data?.find(s => s.id === studentId);

  useEffect(() => {
    if (student) remember(student.id);
  }, [student, remember]);

  const base = studentPath(studentId);
  const groups = [
    {
      items: [
        { label: "Overview", to: base, end: true },
        { label: "Timetable", to: `${base}/timetable` },
        { label: "Attendance", to: `${base}/attendance` },
        { label: "Homework", to: `${base}/homework`, hidden: !can("portal.homework.read") },
        { label: "Results", to: `${base}/results` },
        { label: "Admit cards", to: `${base}/admit-cards` },
        { label: "Fees", to: `${base}/fees`, hidden: !can("portal.fees.read") },
        { label: "Transport & hostel", to: `${base}/transport-hostel`, hidden: !canAny("transport.myTransport.read", "hostel.myHostel.read") }
      ]
    }
  ];

  let content;
  if (students.error) content = <ErrorState error={students.error} onRetry={() => void students.refetch()} />;
  else if (!students.data) content = <SkeletonBlock lines={8} />;
  else if (students.data.length === 0) content = <NoStudents />;
  else if (!student) content = <NotLinked />;
  else content = <Outlet context={{ student, students: students.data } satisfies PortalContext} />;

  return (
    <Page>
      <div className="sidenav-layout">
        <div className="portal-side">
          <ChildSwitcher students={students.data} studentId={studentId} loading={students.isLoading} />
          {student && <SideNav groups={groups} />}
        </div>
        <div className="sidenav-content">{content}</div>
      </div>
    </Page>
  );
}

export function NoStudents() {
  return (
    <EmptyState
      icon={<Users />}
      title="No children are linked to your account yet"
      message="Please contact the school office."
    />
  );
}
