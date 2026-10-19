import { api } from "@/common/api";
import type { Phase } from "../../shared/utils/format";

export const ALLOCATIONS_PATH = "/hostel/allocations";
export const AVAILABILITY_PATH = "/hostel/bed-availability";
export const ROLLOVERS_PATH = "/hostel/allocation-rollovers";

/* GET /hostel/allocations rows (and …/:allocationId). toDate is the last night; null = open-ended. */
export type Allocation = {
  id: string;
  studentId: string;
  hostelId: string;
  roomId: string;
  bedNumber: number;
  fromDate: string;
  toDate: string | null;
  status: "ACTIVE" | "CANCELLED";
  source: "DIRECT" | "TRANSFER" | "ROLLOVER";
  previousAllocationId: string | null;
  endReason: string | null;
  endedAt: string | null;
  notes: string | null;
  phase: Phase;
  student: { id: string; userId: string; studentCode: string; admissionNumber: string; user: { firstName: string; lastName: string } };
  hostel: { id: string; name: string; code: string; residentGender: string };
  room: { id: string; roomNumber: string; floor: number | null; roomType: string | null; monthlyFee: number | null; status: string };
  createdAt: string;
};

export type AvailabilityRoom = {
  id: string;
  roomNumber: string;
  floor: number | null;
  roomType: string | null;
  monthlyFee: number | null;
  capacity: number;
  free: number;
  freeBeds: number[];
};

/* GET /hostel/bed-availability: beds free for the whole range, in rooms that take residents */
export type Availability = {
  fromDate: string;
  toDate: string | null;
  totals: { hostels: number; rooms: number; capacity: number; free: number };
  hostels: {
    id: string;
    name: string;
    code: string;
    residentGender: string;
    capacity: number;
    free: number;
    byRoomType: { roomType: string | null; rooms: number; capacity: number; free: number }[];
    rooms: AvailabilityRoom[];
  }[];
};

export type RolloverEntry = { allocationId: string; student: { id: string; studentCode: string; name: string }; bed: string | null };

/* POST /hostel/allocation-rollovers result (dry run or real) */
export type RolloverResult = {
  fromAcademicYear: { id: string; yearName: string; startDate: string; endDate: string };
  toAcademicYear: { id: string; yearName: string; startDate: string; endDate: string };
  dryRun: boolean;
  continued: (RolloverEntry & { newAllocationId: string })[];
  skipped: (RolloverEntry & { reason: string })[];
  resources: {
    continued: { assignmentId: string; resource: { id: string; name: string } | null; student: RolloverEntry["student"]; newAssignmentId: string }[];
    skipped: { assignmentId: string; resource: { id: string; name: string } | null; student: RolloverEntry["student"]; reason: string }[];
  } | null;
};

export type AllocateInput = { studentId: string; roomId: string; bedNumber?: number; fromDate?: string; toDate?: string | null; notes?: string };

export const allocateBed = (body: AllocateInput) => api.post<Allocation>(ALLOCATIONS_PATH, body);

export const updateAllocation = ({ id, ...body }: { id: string; fromDate?: string; toDate?: string | null; notes?: string }) =>
  api.patch<Allocation>(`${ALLOCATIONS_PATH}/${id}`, body);

export const transferBed = ({ id, ...body }: { id: string; roomId: string; bedNumber?: number; fromDate?: string; notes?: string }) =>
  api.post<Allocation>(`${ALLOCATIONS_PATH}/${id}/transfer`, body);

export const vacateBed = ({ id, ...body }: { id: string; vacatedOn?: string; notes?: string }) => api.post<Allocation>(`${ALLOCATIONS_PATH}/${id}/vacate`, body);

export const cancelAllocation = ({ id, reason }: { id: string; reason?: string }) =>
  api.post<Allocation>(`${ALLOCATIONS_PATH}/${id}/cancellation`, reason ? { reason } : {});

export const runRollover = (body: { toAcademicYearId: string; includeResources: boolean; dryRun: boolean }) => api.post<RolloverResult>(ROLLOVERS_PATH, body);

/* "Bed 2, Room A-101, Aravali House" */
export const bedLabel = (a: Pick<Allocation, "bedNumber" | "room" | "hostel">) => `Bed ${a.bedNumber}, room ${a.room.roomNumber}, ${a.hostel.name}`;
