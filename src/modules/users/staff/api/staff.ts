import { api, type Role } from "@/common/api";
import { useApiGet } from "@/common/hooks";

/* The roles a staff account can have (users/staff); the role is fixed once created */
export const STAFF_ROLES = [
  "ADMIN",
  "PRINCIPAL",
  "ACCOUNTANT",
  "STAFF",
  "LIBRARIAN",
  "TRANSPORT_MANAGER",
  "HOSTEL_MANAGER",
  "HR_MANAGER",
  "INVENTORY_MANAGER"
] as const satisfies readonly Role[];

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_INFO: Record<StaffRole, { label: string; description: string }> = {
  ADMIN: { label: "Administrator", description: "Full access to every module, school settings and user accounts." },
  PRINCIPAL: { label: "Principal", description: "Runs academics, manages teachers and reads most records." },
  ACCOUNTANT: { label: "Accountant", description: "Fees, invoices, payments, refunds and the ledger." },
  STAFF: { label: "Office staff", description: "Front office: admissions, parents, enrollments and documents." },
  LIBRARIAN: { label: "Owner of Library", description: "Runs the library and decides who helps there (Librarian)." },
  TRANSPORT_MANAGER: { label: "Owner of Transport", description: "Runs vehicles, routes and seats, and who helps (Transport manager)." },
  HOSTEL_MANAGER: { label: "Owner of Hostel", description: "Runs hostels, rooms and allocations, and who helps (Hostel manager)." },
  HR_MANAGER: { label: "Owner of HR", description: "Runs leave, staff attendance and payroll, and who helps (HR manager)." },
  INVENTORY_MANAGER: { label: "Owner of Inventory", description: "Runs items, vendors and stock, and who helps (Inventory manager)." }
};

export type StaffMember = {
  id: string;
  userId: string;
  employeeCode: string;
  designation: string | null;
  department: string | null;
  qualification: string | null;
  joiningDate: string | null;
  employmentType: "FULL_TIME" | "PART_TIME" | null;
  bloodGroup: string | null;
  description: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; phone: string | null; role: Role };
};

export const STAFF_PROFILE_KEYS = ["designation", "department"];

export const useStaffMember = (staffId: string | undefined) => useApiGet<StaffMember>(staffId ? `/users/staff/${staffId}` : null);

export const createStaffMember = (body: { role: string; user: Record<string, unknown>; profile: Record<string, unknown> }) =>
  api.post<StaffMember>("/users/staff", body);

export const updateStaffMember = (staffId: string, body: Record<string, string>) => api.patch<StaffMember>(`/users/staff/${staffId}`, body);
