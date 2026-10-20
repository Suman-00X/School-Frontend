import { buildUrl, toApiError, type ListMeta, type Query } from "@/common/api";
import { consoleSession } from "./session";

/* Requests to /api/v1/platform with the system admin's session cookie (never the school
   session's token). X-Requested-With on every call: the API refuses changes without it, so
   another site can never use the cookie. */
async function request<T>(method: string, path: string, { body, query }: { body?: unknown; query?: Query } = {}) {
  const headers: Record<string, string> = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(buildUrl(`/platform${path}`, query), {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const error = toApiError(res, json);
    /* A session that ends mid-way (expired, signed out elsewhere). Not the sign-in itself, nor
       the check of who is signed in: there being nobody yet is not an ending. */
    if (res.status === 401 && path !== "/auth/login" && path !== "/auth/me") consoleSession.ended(error.message);
    throw error;
  }
  return { data: json?.data as T, meta: json?.meta as (ListMeta & Record<string, unknown>) | undefined, message: (json?.message as string | undefined) ?? "" };
}

export const platformApi = {
  get: <T,>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T,>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  put: <T,>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T,>(path: string, body?: unknown) => request<T>("PATCH", path, { body })
};
