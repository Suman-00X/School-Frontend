import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";

/* GET /me/teaching/sections: the current year's sections a teacher teaches, with their role */
export type MyTeachingSection = {
  sectionId: string;
  /* "Class 6-A" */
  section: string;
  isClassTeacher: boolean;
  isDeputyClassTeacher: boolean;
  subjectIds: string[];
};

/* A teacher account is limited to its own sections (the backend's teaching scope). People
   with portal.learning.teaching are teachers; everyone else is not scoped.
   leads(): class teacher or deputy of the section. */
export function useMyTeaching() {
  const { can } = useAuth();
  const scoped = can("portal.learning.teaching");
  const q = useQuery({
    queryKey: ["/me/teaching/sections"],
    enabled: scoped,
    staleTime: 60_000,
    queryFn: async () => (await api.get<MyTeachingSection[]>("/me/teaching/sections")).data
  });
  const sections = q.data ?? [];
  const byId = new Map(sections.map(s => [s.sectionId, s]));
  return {
    scoped,
    sections,
    isLoading: scoped && q.isLoading,
    error: q.error,
    /* Not scoped: true (ADMIN, PRINCIPAL; the backend still checks) */
    leads: (sectionId: string) => !scoped || !!(byId.get(sectionId)?.isClassTeacher || byId.get(sectionId)?.isDeputyClassTeacher),
    teaches: (sectionId: string) => !scoped || byId.has(sectionId),
    of: (sectionId: string) => byId.get(sectionId)
  };
}
