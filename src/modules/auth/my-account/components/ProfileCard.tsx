import { useAuth, type Me } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { Card, DescriptionList, ErrorState, RoleBadge, type DLItem } from "@/common/ui";
import { enumLabel, formatDate, formatDateTime, fullName } from "@/common/utils/format";

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : null);

/* The role profile's own fields (student, parent, teacher or staff member) */
function profileItems(role: string, p: Record<string, unknown> | null): DLItem[] {
  if (!p) return [];
  switch (role) {
    case "STUDENT":
      return [
        { label: "Student code", value: <span className="mono">{str(p.studentCode)}</span> },
        { label: "Admission number", value: str(p.admissionNumber) }
      ];
    case "PARENT":
      return [
        { label: "Parent code", value: <span className="mono">{str(p.parentCode)}</span> },
        { label: "Occupation", value: str(p.occupation) }
      ];
    case "TEACHER":
      return [
        { label: "Employee code", value: <span className="mono">{str(p.employeeCode)}</span> },
        { label: "Qualification", value: str(p.qualification) },
        { label: "Joining date", value: formatDate(str(p.joiningDate)) }
      ];
    default:
      if (!("employeeCode" in p)) return [];
      return [
        { label: "Employee code", value: <span className="mono">{str(p.employeeCode)}</span> },
        { label: "Designation", value: str(p.designation) },
        { label: "Department", value: str(p.department) }
      ];
  }
}

/* While loading: the same list with grey values (the role from sign-in tells which profile fields come) */
function loadingItems(role: string | undefined): DLItem[] {
  /* Inline, so it sits on a text line: each value keeps the height of a loaded one */
  const bar = <span className="skeleton" style={{ display: "inline-block", verticalAlign: "middle", width: "60%", height: "0.8em" }} />;
  const own = profileItems(role ?? "", role === "STUDENT" || role === "PARENT" || role === "TEACHER" ? {} : { employeeCode: "" });
  return [
    ...["Name", "Role", "Email", "Phone", "Gender", "Date of birth"].map(label => ({ label, value: bar })),
    { label: "Address", value: bar, wide: true },
    ...own.map(i => ({ label: i.label, value: bar })),
    { label: "Last sign-in", value: bar }
  ];
}

export function ProfileCard() {
  const { session } = useAuth();
  const { data, isLoading, error, refetch } = useApiGet<Me>("/me");

  let body;
  if (error) body = <ErrorState error={error} onRetry={() => void refetch()} />;
  else if (isLoading || !data) body = <DescriptionList items={loadingItems(session?.user.role)} />;
  else {
    const a = data.account;
    body = (
      <DescriptionList
        items={[
          { label: "Name", value: fullName(a, true) },
          { label: "Role", value: <RoleBadge role={data.role} /> },
          { label: "Email", value: a.email },
          { label: "Phone", value: a.phone },
          { label: "Gender", value: enumLabel(a.gender) },
          { label: "Date of birth", value: formatDate(a.dob) },
          { label: "Address", value: a.address, wide: true },
          ...profileItems(data.role, data.profile),
          { label: "Last sign-in", value: formatDateTime(a.lastLoginAt) }
        ]}
      />
    );
  }

  return (
    <Card title="Profile" subtitle="To change your details, contact the school office.">
      {body}
    </Card>
  );
}
