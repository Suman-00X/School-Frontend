import { useMemo, type ChangeEventHandler, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { Select, type Option } from "@/common/ui";
import type { Section } from "../../classes/api/sections";

/* "Class 5 – A" */
export const sectionTitle = (s: Pick<Section, "sectionName"> & { class?: { className: string } | null }) =>
  `${s.class?.className ?? "Class"} – ${s.sectionName}`;

/* Every section of the header's academic year the person may see (a teacher: the ones they
   teach in), in class order then section name */
export function useSectionOptions(enabled = true) {
  const { can } = useAuth();
  const allowed = enabled && can("academics.sections.read");
  const q = useQuery({
    queryKey: ["/academics/sections", { all: true }],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: async () => {
      const rows: Section[] = [];
      for (let page = 1; ; page++) {
        const res = await api.get<Section[]>("/academics/sections", { page, limit: 100 });
        rows.push(...res.data);
        if (!res.meta || page >= res.meta.totalPages) break;
      }
      return rows.sort(
        (a, b) => (a.class?.classOrder ?? 0) - (b.class?.classOrder ?? 0) || a.sectionName.localeCompare(b.sectionName)
      );
    }
  });
  const sections = q.data;
  const options = useMemo<Option[]>(() => (sections ?? []).map(s => ({ value: s.id, label: sectionTitle(s) })), [sections]);
  const byId = useMemo(() => new Map((sections ?? []).map(s => [s.id, s])), [sections]);
  return { allowed, sections: sections ?? [], options, byId, isLoading: q.isLoading, error: q.error };
}

/* Pick a section of the header's year (searchable when the school has many) */
export function SectionSelect({
  label = "Section",
  value,
  onChange,
  placeholder,
  required,
  error,
  hint,
  disabled,
  className,
  classId
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
  /* Only this class's sections */
  classId?: string;
}) {
  const { options, byId, isLoading } = useSectionOptions();
  const shown = classId ? options.filter(o => byId.get(o.value)?.classId === classId) : options;
  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      options={shown}
      placeholder={isLoading ? "Loading sections…" : (placeholder ?? "Pick a section")}
      required={required}
      error={error}
      hint={hint}
      disabled={disabled}
      className={className}
    />
  );
}
