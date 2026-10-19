import type { AccessView } from "@/common/api";
import { useApiGet } from "@/common/hooks";

/* Effective access of any account: ADMIN sees every module, an owner the modules they own */
export const useUserAccess = (userId: string | null | undefined, enabled = true) =>
  useApiGet<AccessView>(userId ? `/administration/access/users/${userId}/access` : null, undefined, { enabled });
