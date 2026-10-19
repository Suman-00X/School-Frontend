import { api } from "@/common/api";
import { useApiGet, useApiList } from "@/common/hooks";
import type { ResidentGender, RoomStatus } from "../../shared/utils/format";

export const HOSTELS_PATH = "/hostel/hostels";

export type Warden = { id: string; firstName: string; lastName: string; email: string; phone: string | null; role: string };

/* GET /hostel/hostels rows (and …/:hostelId) */
export type Hostel = {
  id: string;
  name: string;
  code: string;
  residentGender: ResidentGender;
  wardenUserId: string | null;
  address: string | null;
  contactPhone: string | null;
  description: string | null;
  warden: Warden | null;
  createdAt: string;
  updatedAt: string;
};

export type HostelInput = {
  name: string;
  code?: string;
  residentGender: ResidentGender;
  wardenUserId?: string | null;
  address?: string;
  contactPhone?: string;
  description?: string;
};

export type Occupant = { bedNumber: number; allocationId: string; toDate: string | null; student: { id: string; studentCode: string; name: string } };

/* GET /hostel/hostels/:hostelId/occupancy?on= : beds taken and free on one day */
export type Occupancy = {
  hostel: { id: string; name: string; code: string; residentGender: ResidentGender };
  on: string;
  totals: { rooms: number; capacity: number; occupied: number; free: number; allocatable: number };
  rooms: {
    id: string;
    roomNumber: string;
    floor: number | null;
    roomType: string | null;
    status: RoomStatus;
    capacity: number;
    occupied: number;
    free: number;
    freeBeds: number[];
    occupants: Occupant[];
  }[];
};

export const createHostel = (body: HostelInput) => api.post<Hostel>(HOSTELS_PATH, body);
export const updateHostel = ({ id, ...body }: Partial<HostelInput> & { id: string }) => api.patch<Hostel>(`${HOSTELS_PATH}/${id}`, body);
export const removeHostel = (id: string) => api.delete<unknown>(`${HOSTELS_PATH}/${id}`);

export const occupancyPath = (hostelId: string) => `${HOSTELS_PATH}/${hostelId}/occupancy`;

/* Every hostel (a school has a few): switchers and pickers */
export function useAllHostels(enabled = true) {
  return useApiList<Hostel>(HOSTELS_PATH, { limit: 100 }, { enabled });
}

export function useOccupancy(hostelId: string | null, on?: string, enabled = true) {
  return useApiGet<Occupancy>(hostelId && enabled ? occupancyPath(hostelId) : null, on ? { on } : undefined);
}

export const wardenName = (w: Warden | null) => (w ? `${w.firstName} ${w.lastName}`.trim() : "");
