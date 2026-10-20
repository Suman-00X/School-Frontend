import { buildUrl, toApiError, type Query } from "@/common/api";
import { operatorSession } from "./session";

/* Requests to /api/v1/platform with the operator's token (never the school session's) */
async function request<T>(method: string, path: string, { body, query, auth = true }: { body?: unknown; query?: Query; auth?: boolean } = {}) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const session = operatorSession.get();
  if (auth && session) headers.Authorization = `Bearer ${session.accessToken}`;
  const res = await fetch(buildUrl(`/platform${path}`, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const error = toApiError(res, json);
    if (auth && res.status === 401) operatorSession.clear(error.message);
    throw error;
  }
  return { data: json?.data as T, message: (json?.message as string | undefined) ?? "" };
}

export const platformApi = {
  get: <T,>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T,>(path: string, body?: unknown, opts?: { auth?: boolean }) => request<T>("POST", path, { body, ...opts }),
  put: <T,>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T,>(path: string, body?: unknown) => request<T>("PATCH", path, { body })
};
