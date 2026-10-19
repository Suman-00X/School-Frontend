import { api } from "@/common/api";
import type { RoomStatus } from "../../shared/utils/format";

export const ROOMS_PATH = "/hostel/rooms";

/* GET /hostel/rooms rows: today's occupied count and free bed numbers */
export type Room = {
  id: string;
  hostelId: string;
  roomNumber: string;
  floor: number | null;
  capacity: number;
  roomType: string | null;
  monthlyFee: number | null;
  status: RoomStatus;
  description: string | null;
  hostel: { id: string; name: string; code: string; residentGender: string };
  occupied: number;
  freeBeds: number[];
};

export type RoomInput = {
  hostelId: string;
  roomNumber: string;
  floor?: number;
  capacity: number;
  roomType?: string;
  monthlyFee?: number;
  status?: RoomStatus;
  description?: string;
};

export const createRoom = (body: RoomInput) => api.post<Room>(ROOMS_PATH, body);
export const updateRoom = ({ id, ...body }: Partial<Omit<RoomInput, "hostelId">> & { id: string }) => api.patch<Room>(`${ROOMS_PATH}/${id}`, body);
export const removeRoom = (id: string) => api.delete<unknown>(`${ROOMS_PATH}/${id}`);
