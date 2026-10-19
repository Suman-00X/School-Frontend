/* Shapes the backend returns everywhere (framework level only; module types live in the modules) */

export type Role =
  | "ADMIN"
  | "PRINCIPAL"
  | "ACCOUNTANT"
  | "STAFF"
  | "TEACHER"
  | "STUDENT"
  | "PARENT"
  | "HR_MANAGER"
  | "LIBRARIAN"
  | "TRANSPORT_MANAGER"
  | "HOSTEL_MANAGER"
  | "INVENTORY_MANAGER";

export const ROLES: Role[] = [
  "ADMIN",
  "PRINCIPAL",
  "ACCOUNTANT",
  "STAFF",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "HR_MANAGER",
  "LIBRARIAN",
  "TRANSPORT_MANAGER",
  "HOSTEL_MANAGER",
  "INVENTORY_MANAGER"
];

export const EMPLOYEE_ROLES: Role[] = ROLES.filter(r => r !== "STUDENT" && r !== "PARENT");

export type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";
export type Gender = "MALE" | "FEMALE" | "OTHER";

/* A user account (GET /users/:userId, GET /me → account) */
export type Account = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  gender: Gender | null;
  dob: string | null;
  address: string | null;
  status: UserStatus;
  isActive?: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

/* GET /administration/access/me/access and /administration/access/users/:userId/access */
export type PermissionSource = {
  type: "ROLE" | "OPERATOR" | "OWNER";
  role?: string;
  operatorRoleId?: string;
  operatorRoleName?: string;
  assignmentId?: string;
  validFrom?: string | null;
  validTo?: string | null;
};

export type AccessPermission = { key: string; action: string; label: string; sources: PermissionSource[] };
export type AccessResource = { resource: string; label: string; permissions: AccessPermission[] };
export type AccessModule = { module: string; label: string; owner: boolean; resources: AccessResource[] };
export type AccessAssignment = {
  id: string;
  kind: "OPERATOR" | "OWNER";
  module: string;
  moduleLabel?: string;
  operatorRole?: { id: string; name: string } | null;
  validFrom: string | null;
  validTo: string | null;
  status: "SCHEDULED" | "ACTIVE" | "EXPIRED" | "REVOKED";
};
export type AccessView = {
  user?: unknown;
  asOf: string;
  modules: AccessModule[];
  assignments: AccessAssignment[];
};

/* Audit log / module activity entry */
export type AuditEntry = {
  id: string;
  createdAt: string;
  userId: string | null;
  role: string | null;
  actor?: { name?: string; role?: string } | null;
  module: string;
  action?: string | null;
  permission: string;
  summary?: string | null;
  entityId?: string | null;
  method: string;
  path?: string;
  statusCode?: number;
  payload?: unknown;
  ipAddress?: string | null;
};

export type AcademicYear = {
  id: string;
  yearName: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  archivedAt: string | null;
};
