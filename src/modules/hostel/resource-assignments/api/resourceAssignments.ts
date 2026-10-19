import { api } from "@/common/api";
import type { Phase, ResourceType } from "../../shared/utils/format";

export const RESOURCE_ASSIGNMENTS_PATH = "/hostel/resource-assignments";

/* GET /hostel/resource-assignments rows (and …/:assignmentId). toDate null = open-ended. */
export type ResourceAssignment = {
  id: string;
  resourceId: string;
  studentId: string;
  hostelId: string;
  allocationId: string | null;
  planType: string | null;
  fromDate: string;
  toDate: string | null;
  status: "ACTIVE" | "CANCELLED";
  previousAssignmentId: string | null;
  endReason: string | null;
  notes: string | null;
  phase: Phase;
  resource: { id: string; hostelId: string; roomId: string | null; name: string; resourceType: ResourceType; customType: string | null; capacity: number; monthlyFee: number | null };
  student: { id: string; studentCode: string; admissionNumber: string; user: { firstName: string; lastName: string } };
  allocation: { id: string; roomId: string; bedNumber: number; fromDate: string; toDate: string | null; status: string } | null;
  createdAt: string;
};

export type GiveInput = { resourceId: string; studentId: string; allocationId?: string; fromDate?: string; toDate?: string | null; notes?: string };

export const giveResource = (body: GiveInput) => api.post<ResourceAssignment>(RESOURCE_ASSIGNMENTS_PATH, body);

export const updateResourceAssignment = ({ id, ...body }: { id: string; fromDate?: string; toDate?: string | null; notes?: string }) =>
  api.patch<ResourceAssignment>(`${RESOURCE_ASSIGNMENTS_PATH}/${id}`, body);

export const releaseResource = ({ id, ...body }: { id: string; releasedOn?: string; notes?: string }) =>
  api.post<ResourceAssignment>(`${RESOURCE_ASSIGNMENTS_PATH}/${id}/release`, body);

export const cancelResourceAssignment = ({ id, reason }: { id: string; reason?: string }) =>
  api.post<ResourceAssignment>(`${RESOURCE_ASSIGNMENTS_PATH}/${id}/cancellation`, reason ? { reason } : {});
