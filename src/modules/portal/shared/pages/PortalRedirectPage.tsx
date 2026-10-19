import { Navigate, useParams } from "react-router-dom";
import { ErrorState, Page, PageLoader } from "@/common/ui";
import { studentPath, useMyStudents } from "../api/students";
import { NoStudents } from "../components/PortalLayout";
import { useRememberedStudent } from "../hooks/useRememberedStudent";

/* /me/school and /me/school/<page>: the fixed links of the navigation. They open the child
   last looked at on this device (else the first one, which for a student is themselves) at
   /me/students/:studentId/<page>. */
export default function PortalRedirectPage() {
  const { "*": rest = "" } = useParams();
  const students = useMyStudents();
  const { read } = useRememberedStudent();

  if (students.error)
    return (
      <Page>
        <ErrorState error={students.error} onRetry={() => void students.refetch()} />
      </Page>
    );
  if (!students.data) return <PageLoader />;
  if (!students.data.length)
    return (
      <Page>
        <NoStudents />
      </Page>
    );

  const remembered = read();
  const pick = students.data.find(s => s.id === remembered) ?? students.data[0]!;
  return <Navigate to={`${studentPath(pick.id)}${rest ? `/${rest}` : ""}`} replace />;
}
