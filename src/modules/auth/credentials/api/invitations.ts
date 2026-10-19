import { api } from "@/common/api";

export type InvitationResult = {
  invited: string[];
  skipped: { userId: string; reason: string; email?: string }[];
};

/* POST /auth/invitations — up to 500 accounts; accounts that already have a password are skipped */
export const sendInvitations = (userIds: string[]) => api.post<InvitationResult>("/auth/invitations", { userIds });
