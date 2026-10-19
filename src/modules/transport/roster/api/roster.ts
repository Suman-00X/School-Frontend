import type { Direction } from "../../shared/utils/format";
import type { RouteVehicle } from "../../routes/api/routes";

export type RosterRider = {
  assignmentId: string;
  studentId: string;
  studentCode: string | null;
  name: string;
  /* "Class 6-B" */
  classSection: string | null;
  rollNumber: string | null;
  direction: Direction;
  parentName: string | null;
  parentPhone: string | null;
};

/* GET /transport/routes/:routeId/roster (selected year) */
export type Roster = {
  route: { id: string; name: string; code: string; description: string | null };
  vehicle: RouteVehicle | null;
  academicYear: { id: string; yearName: string };
  occupancy: { capacity: number | null; assigned: number; available: number | null };
  stops: {
    id: string;
    sequence: number;
    name: string;
    landmark: string | null;
    pickupTime: string | null;
    dropTime: string | null;
    students: RosterRider[];
  }[];
};

export const rosterPath = (routeId: string) => `/transport/routes/${routeId}/roster`;
