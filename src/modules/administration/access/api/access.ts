import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiList, useApiMutation } from "@/common/hooks";

const BASE = "/administration/access";

/* ---- permission catalogue: GET /administration/access/permissions ---- */

export type CataloguePermission = {
  key: string;
  resource: string;
  action: string;
  label: string;
  roles: string[];
  ownerOnly: boolean;
  selfService: boolean;
  grantable: boolean;
};
export type CatalogueResource = { resource: string; label: string; permissions: CataloguePermission[] };
export type CatalogueModule = {
  module: string;
  label: string;
  /* Has owners and operator roles (the add-on modules) */
  operatorRoles: boolean;
  ownerRole: string | null;
  resources: CatalogueResource[];
};

/* What an operator role may hold, per module (or every add-on module without one) */
export const useGrantableCatalogue = (module?: string, enabled = true) =>
  useQuery({
    queryKey: [`${BASE}/permissions`, { module: module ?? "", grantable: true }],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }) =>
      (await api.get<CatalogueModule[]>(`${BASE}/permissions`, { module, grantable: true }, { signal })).data
  });

/* The add-on modules the signed-in person administers: ADMIN all of them, an owner theirs */
export function useManagedModules() {
  const { can } = useAuth();
  const catalogue = useGrantableCatalogue(undefined, can("administration.access.read"));
  const modules = useMemo(
    () =>
      (catalogue.data ?? [])
        .filter(m => m.operatorRoles && can(`${m.module}.access.manage`))
        .map(m => ({ value: m.module, label: m.label })),
    [catalogue.data, can]
  );
  return { modules, isLoading: catalogue.isLoading, error: catalogue.error };
}

/* ---- operator roles ---- */

export type PermissionDetail = { key: string; label: string; available: boolean };

export type OperatorRole = {
  id: string;
  module: string;
  moduleLabel: string;
  name: string;
  description: string | null;
  permissions: string[];
  permissionDetails: PermissionDetail[];
  /* Live or upcoming assignments */
  holders?: number;
  createdAt: string;
  updatedAt: string;
};

export type OperatorRoleBody = { module: string; name: string; description?: string; permissions: string[] };

export const useOperatorRoles = (query: { module?: string; search?: string; page?: number; limit?: number }, enabled = true) =>
  useApiList<OperatorRole>(`${BASE}/operator-roles`, query, { enabled });

export const useOperatorRole = (id: string | null | undefined) =>
  useApiGet<OperatorRole>(id ? `${BASE}/operator-roles/${id}` : null);

const invalidate = [BASE];

export const useCreateOperatorRole = () =>
  useApiMutation((body: OperatorRoleBody) => api.post<OperatorRole>(`${BASE}/operator-roles`, body), { invalidate });

export const useUpdateOperatorRole = (id: string) =>
  useApiMutation(
    (changes: Partial<Omit<OperatorRoleBody, "module">>) => api.patch<OperatorRole>(`${BASE}/operator-roles/${id}`, changes),
    { invalidate }
  );

export const useDeleteOperatorRole = () =>
  useApiMutation((id: string) => api.delete<OperatorRole>(`${BASE}/operator-roles/${id}`), { invalidate });

/* ---- assignments ---- */

export type AssignmentKind = "OPERATOR" | "OWNER";
export type AssignmentStatus = "SCHEDULED" | "ACTIVE" | "EXPIRED" | "REVOKED";
export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ["ACTIVE", "SCHEDULED", "EXPIRED", "REVOKED"];

type PersonRef = { id: string; firstName: string; lastName: string; role: string };

export type Assignment = {
  id: string;
  kind: AssignmentKind;
  module: string;
  moduleLabel: string;
  operatorRoleId: string | null;
  userId: string;
  validFrom: string | null;
  validTo: string | null;
  note: string | null;
  status: AssignmentStatus;
  user: PersonRef & { email: string; status: string };
  operatorRole: { id: string; name: string; module: string } | null;
  assignedBy: string;
  assigner: PersonRef | null;
  revokedAt: string | null;
  revoker: PersonRef | null;
  revokeReason: "REVOKED" | "HANDOVER" | null;
  createdAt: string;
};

export type AssignmentQuery = {
  module?: string;
  kind?: AssignmentKind;
  userId?: string;
  operatorRoleId?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export type NewAssignment =
  | { kind?: "OPERATOR"; operatorRoleId: string; userId: string; validFrom?: string; validTo?: string; note?: string }
  | { kind: "OWNER"; module: string; userId: string; validFrom?: string; validTo?: string; note?: string };

export type AssignmentChanges = { validFrom?: string | null; validTo?: string | null; note?: string | null };

export const useAssignments = (query: AssignmentQuery, enabled = true) =>
  useApiList<Assignment>(`${BASE}/assignments`, query, { enabled });

export const useAssignment = (id: string | null | undefined) => useApiGet<Assignment>(id ? `${BASE}/assignments/${id}` : null);

export const useCreateAssignment = () =>
  useApiMutation((body: NewAssignment) => api.post<Assignment>(`${BASE}/assignments`, body), { invalidate });

export const useUpdateAssignment = () =>
  useApiMutation(
    ({ id, changes }: { id: string; changes: AssignmentChanges }) => api.patch<Assignment>(`${BASE}/assignments/${id}`, changes),
    { invalidate }
  );

export const useRevokeAssignment = () =>
  useApiMutation((id: string) => api.delete<Assignment>(`${BASE}/assignments/${id}`), { invalidate });

/* "Library assistant" or "Owner" */
export const accessName = (a: Pick<Assignment, "kind" | "operatorRole">) =>
  a.kind === "OWNER" ? "Owner" : (a.operatorRole?.name ?? "Operator role");

/* ---- handovers ---- */

export type HandoverBody = { module: string; fromUserId: string; toUserId: string; note?: string; includeOwnership?: boolean };

export type HandoverResult = {
  module: string;
  moduleLabel: string;
  from: { id: string; name: string; role: string };
  to: { id: string; name: string; role: string };
  note: string;
  assignments: {
    kind: AssignmentKind;
    label: string;
    operatorRole: { id: string; name: string } | null;
    endedAssignmentId: string;
    assignmentId: string;
    validFrom: string | null;
    validTo: string | null;
  }[];
  records: { kind: string; label: string; count: number; records: { id: string; name: string }[] }[];
};

export const useHandover = () =>
  useApiMutation((body: HandoverBody) => api.post<HandoverResult>(`${BASE}/handovers`, body), { invalidate });
