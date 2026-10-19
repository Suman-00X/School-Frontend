/* Page paths of the Access control area */
export const ROLES_PATH = "/administration/access/operator-roles";
export const ASSIGNMENTS_PATH = "/administration/access/assignments";
export const OWNERS_PATH = "/administration/access/assignments/owners";
export const HANDOVER_PATH = "/administration/access/handovers/new";

export const rolePath = (id: string) => `${ROLES_PATH}/${id}`;
