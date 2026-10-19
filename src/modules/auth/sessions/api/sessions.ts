import { api } from "@/common/api";
import type { LoginResult } from "@/common/auth";

export type LoginInput = { schoolCode: string; email: string; password: string };

/* A signed-in device (GET /auth/sessions) */
export type DeviceSession = {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
};

export const SESSIONS_PATH = "/auth/sessions";

export const login = (body: LoginInput) => api.post<LoginResult>("/auth/login", body, { auth: false });

export const revokeSession = (sessionId: string) => api.delete<null>(`${SESSIONS_PATH}/${sessionId}`);
