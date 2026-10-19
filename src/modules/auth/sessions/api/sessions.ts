import { api } from "@/common/api";
import type { LoginResult } from "@/common/auth";

/* No school code: the server finds the person's schools. schoolId picks one after "choose a school";
   schoolCode is used when a link names the school (reset and invitation links carry ?school=). */
export type LoginInput = { email: string; password: string; schoolId?: string; schoolCode?: string };

/* The password was right in more than one school (200, no tokens yet) */
export type SchoolChoice = { id: string; name: string; code: string; role: string; logoUrl: string | null };
export type ChooseSchool = { chooseSchool: true; schools: SchoolChoice[] };

export const isChooseSchool = (r: LoginResult | ChooseSchool): r is ChooseSchool => "chooseSchool" in r && r.chooseSchool;

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

export const login = (body: LoginInput) => api.post<LoginResult | ChooseSchool>("/auth/login", body, { auth: false });

export const revokeSession = (sessionId: string) => api.delete<null>(`${SESSIONS_PATH}/${sessionId}`);
