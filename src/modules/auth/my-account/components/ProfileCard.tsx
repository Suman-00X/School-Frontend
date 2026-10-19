import type { Me } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { Card, DescriptionList, ErrorState, RoleBadge, SkeletonBlock, type DLItem } from "@/common/ui";
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

export function ProfileCard() {
  const { data, isLoading, error, refetch } = useApiGet<Me>("/me");

  let body;
  if (error) body = <ErrorState error={error} onRetry={() => void refetch()} />;
  else if (isLoading || !data) body = <SkeletonBlock lines={6} />;
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
