import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { platformApi } from "./client";
import type { Operator } from "./session";

export type CatalogueModule = { key: string; label: string; description: string; core: boolean };

export type ModuleState = { key: string; label: string; core: boolean; enabled: boolean };

export type SchoolStatus = "ACTIVE" | "SUSPENDED";

export type SchoolSummary = {
  id: string;
  code: string;
  name: string;
  status: SchoolStatus;
  /* Switched-on modules, core ones included */
  modules: string[];
  createdAt: string;
};

export type SchoolAdmin = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  invitationPending: boolean;
  lastLoginAt: string | null;
};

export type SchoolProfile = {
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  description: string | null;
  timezone: string;
  currency: string;
  country: string;
};

export type SchoolDetail = SchoolSummary & {
  moduleStates: ModuleState[];
  /* null while the school is suspended (its databases are closed) */
  profile: SchoolProfile | null;
  admins: SchoolAdmin[];
};

export type Invitation = { userId: string; link: string; expiresAt: string; emailed: boolean };

export type OnboardBody = {
  school: {
    name: string;
    code: string;
    address: string;
    contactEmail: string;
    contactPhone: string;
    description?: string;
    timezone: string;
    currency: string;
    country: string;
  };
  admin: { firstName: string; middleName?: string; lastName: string; email: string; phone?: string };
  modules: string[];
};

export type LoginResult = { accessToken: string; expiresIn: number; operator: Operator };

const keys = {
  all: ["platform"] as const,
  catalogue: ["platform", "modules"] as const,
  schools: (filters: object) => ["platform", "schools", filters] as const,
  school: (id: string) => ["platform", "school", id] as const
};

export const platformKeys = keys;

export const operatorLogin = (body: { email: string; password: string }) =>
  platformApi.post<LoginResult>("/auth/login", body, { auth: false });

export const useModuleCatalogue = () =>
  useQuery({ queryKey: keys.catalogue, queryFn: async () => (await platformApi.get<CatalogueModule[]>("/modules")).data, staleTime: Infinity });

export const useSchools = (filters: { search?: string; status?: SchoolStatus }) =>
  useQuery({
    queryKey: keys.schools(filters),
    queryFn: async () => (await platformApi.get<SchoolSummary[]>("/schools", filters)).data,
    placeholderData: keepPreviousData
  });

export const useSchool = (id: string) =>
  useQuery({ queryKey: keys.school(id), queryFn: async () => (await platformApi.get<SchoolDetail>(`/schools/${id}`)).data });

export const checkCode = async (code: string) =>
  (await platformApi.get<{ code: string; available: boolean }>("/schools/code-availability", { code })).data;

export function useOnboardSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OnboardBody) => platformApi.post<{ school: SchoolDetail; invitation: Invitation }>("/schools", body),
    onSuccess: res => {
      qc.setQueryData(keys.school(res.data.school.id), res.data.school);
      void qc.invalidateQueries({ queryKey: ["platform", "schools"] });
    }
  });
}

/* The school's answer replaces the cached one, and the list picks up the change */
function useSchoolMutation<V>(id: string, fn: (vars: V) => Promise<{ data: SchoolDetail; message: string }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: res => {
      qc.setQueryData(keys.school(id), res.data);
      void qc.invalidateQueries({ queryKey: ["platform", "schools"] });
    }
  });
}

export const useSetModules = (id: string) =>
  useSchoolMutation(id, (modules: string[]) => platformApi.put<SchoolDetail>(`/schools/${id}/modules`, { modules }));

export const useSetStatus = (id: string) =>
  useSchoolMutation(id, (status: SchoolStatus) => platformApi.patch<SchoolDetail>(`/schools/${id}/status`, { status }));

export function useInviteAdmin(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => platformApi.post<Invitation>(`/schools/${id}/admins/${userId}/invitations`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.school(id) })
  });
}
