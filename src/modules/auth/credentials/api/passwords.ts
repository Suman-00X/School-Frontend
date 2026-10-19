import { api } from "@/common/api";

/* Public: always 202 with the same message, whether or not the account exists */
export const requestPasswordReset = (body: { schoolCode: string; email: string }) =>
  api.post<null>("/auth/password-reset-requests", body, { auth: false });

/* Public: spends a reset or invitation link (the token says which) */
export const resetPassword = (body: { token: string; password: string }) =>
  api.post<null>("/auth/password-resets", body, { auth: false });

/* Signed in: other devices are signed out */
export const changePassword = (body: { currentPassword: string; newPassword: string }) =>
  api.patch<null>("/auth/password", body);
