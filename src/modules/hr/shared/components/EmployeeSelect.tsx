import { useMemo, type ReactNode } from "react";
import { Select, roleLabel, type Option } from "@/common/ui";
import { useHrEmployees, type Employee } from "../api/employees";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Pick an employee (value = user id). Searches the HR directory on the device. When the directory
   is partial (payroll staff can't list employees), a user id can be pasted instead. */
export function EmployeeSelect({
  value,
  onChange,
  label,
  placeholder = "All employees",
  known = [],
  required,
  error,
  hint,
  disabled,
  className,
  exclude = []
}: {
  value: string;
  onChange: (userId: string, employee: Employee | null) => void;
  label?: ReactNode;
  placeholder?: string;
  /* People already on the page (rows), added to the options */
  known?: Employee[];
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
  exclude?: string[];
}) {
  const { employees, complete, isLoading } = useHrEmployees();
  const pool = useMemo(() => {
    const byId = new Map<string, Employee>();
    for (const e of [...employees, ...known]) if (!byId.has(e.userId) && !exclude.includes(e.userId)) byId.set(e.userId, e);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, known, exclude]);

  const options: Option[] = pool.map(e => ({
    value: e.userId,
    label: e.name,
    description: [e.employeeCode, e.designation ?? roleLabel(e.role)].filter(Boolean).join(" · ") || undefined
  }));

  const fieldProps = label !== undefined || hint !== undefined || error !== undefined ? { label, error, hint: hint ?? (!complete ? "Not listed? Paste their user id." : undefined) } : {};

  return (
    <Select
      {...fieldProps}
      className={className}
      value={value}
      placeholder={isLoading ? "Loading employees…" : placeholder}
      options={options}
      searchable
      creatable={!complete}
      required={required}
      disabled={disabled}
      onChange={e => onChange(e.target.value, pool.find(p => p.userId === e.target.value) ?? null)}
    />
  );
}
