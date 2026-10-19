import { useMemo, type ChangeEventHandler, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/common/auth";
import { Select, type Option } from "@/common/ui";
import { fetchAllPages, type UserSummary } from "../api/profiles";

/* The fields every module needs to name a student */
export type StudentRef = {
  id: string;
  userId: string;
  studentCode: string;
  admissionNumber: string;
  user: UserSummary;
};

export const studentName = (s: Pick<StudentRef, "user">) => `${s.user.firstName} ${s.user.lastName}`.trim();

/* Every student the person may list (a teacher: their sections only). GET /users/students has
   no search (gap), so up to 2,000 are loaded once and filtered on the device. */
export function useStudentOptions(enabled = true) {
  const { can } = useAuth();
  const allowed = enabled && can("users.students.read");
  const q = useQuery({
    queryKey: ["/users/students", "all"],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: () => fetchAllPages<StudentRef>("/users/students", {}, 2000)
  });
  const rows = q.data?.rows;
  const options = useMemo<Option[]>(
    () =>
      (rows ?? [])
        .map(s => ({ value: s.id, label: studentName(s), description: s.admissionNumber }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [rows]
  );
  const byId = useMemo(() => new Map((rows ?? []).map(s => [s.id, s])), [rows]);
  return { allowed, options, byId, students: rows ?? [], isLoading: q.isLoading, error: q.error };
}

/* Pick one student by name or admission number (searchable dropdown).
   onChange gets the id like a native select; the record is in useStudentOptions().byId. */
export function StudentSelect({
  label = "Student",
  value,
  onChange,
  placeholder,
  required,
  error,
  hint,
  disabled,
  className,
  exclude = []
}: {
  label?: ReactNode;
  value: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  placeholder?: string;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
  exclude?: string[];
}) {
  const { options, isLoading } = useStudentOptions();
  const shown = exclude.length ? options.filter(o => o.value === value || !exclude.includes(o.value)) : options;
  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      options={shown}
      searchable
      placeholder={isLoading ? "Loading students…" : (placeholder ?? "Search by name or admission number")}
      required={required}
      error={error}
      hint={hint}
      disabled={disabled}
      className={className}
    />
  );
}
