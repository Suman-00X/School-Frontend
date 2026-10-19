import { api } from "@/common/api";

/* Public: always 202 with the same message, whether or not the account exists.
   Without a school code, every school with this email sends its own link. */
export const requestPasswordReset = (body: { email: string; schoolCode?: string }) =>
  api.post<null>("/auth/password-reset-requests", body, { auth: false });

/* Public: spends a reset or invitation link (the token says which) */
export const resetPassword = (body: { token: string; password: string }) =>
  api.post<null>("/auth/password-resets", body, { auth: false });

/* Signed in: other devices are signed out */
export const changePassword = (body: { currentPassword: string; newPassword: string }) =>
  api.patch<null>("/auth/password", body);
