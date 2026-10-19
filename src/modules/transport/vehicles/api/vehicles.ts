import { api } from "@/common/api";
import { useApiList } from "@/common/hooks";
import type { VehicleStatus } from "../../shared/utils/format";

export const VEHICLES_PATH = "/transport/vehicles";

/* A compliance document expiring within the asked window (30 days when none is asked) */
export type ExpiringDocument = {
  document: "INSURANCE" | "FITNESS_CERTIFICATE" | "PERMIT";
  label: string;
  expiresOn: string;
  daysLeft: number;
  isExpired: boolean;
};

/* GET /transport/vehicles rows */
export type Vehicle = {
  id: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  capacity: number;
  driverName: string | null;
  driverPhone: string | null;
  driverLicenseNumber: string | null;
  attendantName: string | null;
  attendantPhone: string | null;
  insuranceExpiresOn: string | null;
  fitnessCertificateExpiresOn: string | null;
  permitExpiresOn: string | null;
  status: VehicleStatus;
  notes: string | null;
  expiringDocuments: ExpiringDocument[];
  createdAt: string;
  updatedAt: string;
};

/* GET /transport/vehicles/:vehicleId adds the route it serves */
export type VehicleDetail = Vehicle & { route: { id: string; name: string; code: string } | null };

export type VehicleInput = {
  registrationNumber: string;
  make?: string | null;
  model?: string | null;
  capacity: number;
  driverName?: string | null;
  driverPhone?: string | null;
  driverLicenseNumber?: string | null;
  attendantName?: string | null;
  attendantPhone?: string | null;
  insuranceExpiresOn?: string | null;
  fitnessCertificateExpiresOn?: string | null;
  permitExpiresOn?: string | null;
  status?: VehicleStatus;
  notes?: string;
};

export const createVehicle = (body: VehicleInput) => api.post<VehicleDetail>(VEHICLES_PATH, body);

export const updateVehicle = ({ id, ...body }: Partial<VehicleInput> & { id: string }) =>
  api.patch<VehicleDetail>(`${VEHICLES_PATH}/${id}`, body);

export const removeVehicle = (id: string) => api.delete<unknown>(`${VEHICLES_PATH}/${id}`);

export const vehicleName = (v: Pick<Vehicle, "registrationNumber" | "make" | "model">) =>
  [v.make, v.model].filter(Boolean).join(" ") || v.registrationNumber;

/* Every vehicle (a school runs a handful): for pickers and filters */
export function useAllVehicles(enabled = true) {
  return useApiList<Vehicle>(VEHICLES_PATH, { limit: 100 }, { enabled });
}
