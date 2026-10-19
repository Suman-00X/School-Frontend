import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, Select, Skeleton } from "@/common/ui";
import { studentFullName, studentLine, type PortalStudent } from "../api/students";

/* The child at the top of the portal's side list. A parent with several children picks one
   from a dropdown; everyone else sees their name as plain text. Switching keeps the page
   (timetable stays timetable) and its filters. One height whether loading, one child or many. */
export function ChildSwitcher({ students, studentId, loading }: { students: PortalStudent[] | undefined; studentId: string; loading?: boolean }) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const current = students?.find(s => s.id === studentId);

  const switchTo = (id: string) => {
    if (!id || id === studentId) return;
    /* /me/students/:id/<page>/… → /me/students/:new/<page> (record pages go back to their list) */
    const rest = pathname.split("/").slice(4, 5).join("/");
    navigate(`/me/students/${id}${rest ? `/${rest}` : ""}${search}`);
  };

  if (loading || !students)
    return (
      <div className="portal-child">
        <Avatar name="" />
        <div className="portal-child-text">
          <Skeleton width={120} />
          <Skeleton width={150} height={12} />
        </div>
      </div>
    );

  if (students.length > 1)
    return (
      <div className="portal-child portal-child-pick">
        <Select
          aria-label="Student"
          value={current ? studentId : ""}
          placeholder="Choose a student"
          required
          options={students.map(s => ({ value: s.id, label: studentFullName(s), description: studentLine(s) }))}
          onChange={e => switchTo(e.target.value)}
        />
        <div className="portal-child-sub small muted" title={current ? studentLine(current) : undefined}>
          {current ? studentLine(current) : `${students.length} students linked to you`}
        </div>
      </div>
    );

  const only = students[0];
  return (
    <div className="portal-child">
      <Avatar name={only ? studentFullName(only) : ""} />
      <div className="portal-child-text">
        <div className="portal-child-name" title={only ? studentFullName(only) : undefined}>
          {only ? studentFullName(only) : "—"}
        </div>
        <div className="small muted">{only ? studentLine(only) : ""}</div>
      </div>
    </div>
  );
}
