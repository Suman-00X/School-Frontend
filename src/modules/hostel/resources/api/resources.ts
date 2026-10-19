import { api } from "@/common/api";
import type { ResourceStatus, ResourceType } from "../../shared/utils/format";

export const RESOURCES_PATH = "/hostel/resources";

/* GET /hostel/resources rows: today's holders (inUse) and capacity left (available) */
export type Resource = {
  id: string;
  hostelId: string;
  roomId: string | null;
  resourceType: ResourceType;
  customType: string | null;
  name: string;
  capacity: number;
  monthlyFee: number | null;
  status: ResourceStatus;
  description: string | null;
  hostel: { id: string; name: string; code: string };
  room: { id: string; roomNumber: string } | null;
  inUse: number;
  available: number;
};

export type ResourceInput = {
  hostelId: string;
  roomId?: string;
  resourceType: ResourceType;
  name: string;
  capacity?: number;
  customType?: string;
  monthlyFee?: number;
  status?: ResourceStatus;
  description?: string;
};

export type ResourcePatch = Partial<Pick<ResourceInput, "name" | "capacity" | "customType" | "monthlyFee" | "status" | "description">>;

export const createResource = (body: ResourceInput) => api.post<Resource>(RESOURCES_PATH, body);
export const updateResource = ({ id, ...body }: ResourcePatch & { id: string }) => api.patch<Resource>(`${RESOURCES_PATH}/${id}`, body);
export const removeResource = (id: string) => api.delete<unknown>(`${RESOURCES_PATH}/${id}`);
