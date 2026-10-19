import { useMemo } from "react";
import { useAuth } from "@/common/auth";
import { useApiList } from "@/common/hooks";
import { Badge, roleLabel, type Option } from "@/common/ui";
import { useSectionOptions } from "@/modules/academics";
import { useEmployees } from "@/modules/administration";
import type { Announcement, AnnouncementStatus } from "../api/announcements";

type ClassRow = { id: string; className: string; classOrder: number };

/* Classes and sections for the audience pickers and for naming them in the list */
export function useAudienceOptions() {
  const { can } = useAuth();
  const classes = useApiList<ClassRow>("/academics/classes", { page: 1, limit: 100 }, { enabled: can("academics.classes.read") });
  const sections = useSectionOptions();
  const classOptions = useMemo<Option[]>(
    () => [...(classes.rows ?? [])].sort((a, b) => a.classOrder - b.classOrder).map(c => ({ value: c.id, label: c.className })),
    [classes.rows]
  );
  const classNames = useMemo(() => new Map(classOptions.map(o => [o.value, o.label])), [classOptions]);
  const sectionNames = useMemo(() => new Map(sections.options.map(o => [o.value, o.label])), [sections.options]);
  return { classOptions, sectionOptions: sections.options, classNames, sectionNames };
}

/* "Class 8" / "Class 6 – A, Class 6 – B" / "Whole school" for students and parents */
export function audienceScope(a: Pick<Announcement, "audience">, names: { classNames: Map<string, string>; sectionNames: Map<string, string> }) {
  const family = a.audience.roles.some(r => r === "STUDENT" || r === "PARENT");
  if (!family) return null;
  const parts = [
    ...a.audience.classIds.map(id => names.classNames.get(id) ?? "A class"),
    ...a.audience.sectionIds.map(id => names.sectionNames.get(id) ?? "A section")
  ];
  return parts.length ? parts.join(", ") : "Whole school";
}

export function AudienceBadges({ roles }: { roles: string[] }) {
  return (
    <span className="row" style={{ gap: 4 }}>
      {roles.map(r => (
        <Badge key={r} tone={r === "STUDENT" || r === "PARENT" ? "info" : "neutral"}>
          {roleLabel(r)}
        </Badge>
      ))}
    </span>
  );
}

const STATUS: Record<AnnouncementStatus, { label: string; tone: "neutral" | "info" | "success" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  PUBLISHED: { label: "Published", tone: "success" }
};

export function AnnouncementStatusBadge({ status }: { status: AnnouncementStatus }) {
  return (
    <Badge tone={STATUS[status].tone} dot>
      {STATUS[status].label}
    </Badge>
  );
}

/* The author's name: "You", a staff member or teacher the viewer can list, else nothing */
export function useAuthorName() {
  const { me } = useAuth();
  const { people } = useEmployees();
  const byId = useMemo(() => new Map(people.map(p => [p.id, p.name])), [people]);
  return (userId: string) => (userId === me?.account.id ? "You" : (byId.get(userId) ?? null));
}
