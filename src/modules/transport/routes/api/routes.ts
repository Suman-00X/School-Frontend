import { api } from "@/common/api";
import { useApiList } from "@/common/hooks";

export const ROUTES_PATH = "/transport/routes";

export type RouteStop = {
  id: string;
  routeId: string;
  name: string;
  sequence: number;
  /* "07:05:00" */
  pickupTime: string | null;
  dropTime: string | null;
  landmark: string | null;
  monthlyFee: number;
};

export type RouteVehicle = {
  id: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  capacity: number;
  status: string;
  driverName: string | null;
  driverPhone: string | null;
  attendantName: string | null;
  attendantPhone: string | null;
};

/* Seats in the selected year; capacity and available are null when the route has no vehicle */
export type Occupancy = {
  academicYearId: string | null;
  yearName: string | null;
  capacity: number | null;
  assigned: number;
  available: number | null;
};

/* GET /transport/routes rows */
export type TransportRoute = {
  id: string;
  name: string;
  code: string;
  vehicleId: string | null;
  description: string | null;
  vehicle: RouteVehicle | null;
  stops: RouteStop[];
  occupancy: Occupancy;
  createdAt: string;
  updatedAt: string;
};

/* GET /transport/routes/:routeId: stops carry the students using them in the year */
export type RouteDetail = TransportRoute & { stops: (RouteStop & { assignedCount: number })[] };

/* A stop as sent: `id` keeps an existing stop (and its students); sequence follows the order sent */
export type StopInput = {
  id?: string;
  name: string;
  pickupTime?: string;
  dropTime?: string;
  landmark?: string;
  monthlyFee: number;
};

export type RouteInput = {
  name: string;
  code?: string;
  vehicleId?: string | null;
  description?: string;
  stops: StopInput[];
};

export const createRoute = (body: RouteInput) => api.post<RouteDetail>(ROUTES_PATH, body);

export const updateRoute = ({ id, ...body }: Partial<RouteInput> & { id: string }) => api.patch<RouteDetail>(`${ROUTES_PATH}/${id}`, body);

export const removeRoute = (id: string) => api.delete<unknown>(`${ROUTES_PATH}/${id}`);

/* Every route (a school runs a handful): pickers, filters and "which route a vehicle serves" */
export function useAllRoutes(enabled = true) {
  return useApiList<TransportRoute>(ROUTES_PATH, { limit: 100 }, { enabled });
}

/* "12 of 40 seats free" */
export const seatsFreeLabel = (o: Occupancy) =>
  o.capacity === null ? "No vehicle: cannot take students" : `${o.available} of ${o.capacity} seats free`;
