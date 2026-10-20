import { ApiError, errorFromResponse, toApiError } from "./errors";
import { sessionStore, type Session } from "./session";

/* One client for the whole app: base URL, bearer token, token refresh,
   the academic-year header and the response envelope live here only. */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api/v1";

export type ListMeta = { page: number; limit: number; total: number; totalPages: number };

export type ApiResponse<T> = { data: T; meta?: ListMeta; message: string };

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue | QueryValue[]>;

export type RequestOptions = {
  query?: Query;
  body?: unknown;
  form?: FormData;
  /* false for the public endpoints (sign-in, password links) */
  auth?: boolean;
  /* Overrides the header's year for this call; null sends no year */
  academicYearId?: string | null;
  signal?: AbortSignal;
};

/* ---- events the session layer listens to ---- */

type ClientEvent = { type: "session-ended"; message?: string } | { type: "forbidden" };
const listeners = new Set<(e: ClientEvent) => void>();
export const onClientEvent = (fn: (e: ClientEvent) => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const emit = (e: ClientEvent) => listeners.forEach(fn => fn(e));

export function endSession(message?: string) {
  sessionStore.clear();
  emit({ type: "session-ended", message });
}

/* ---- academic year (set by the year switcher) ---- */

let academicYearId: string | null = null;
export const setAcademicYearHeader = (id: string | null) => {
  academicYearId = id;
};

/* ---- token refresh: one at a time across every tab ---- */

const SESSION_ENDED = "Your session has ended. Please sign in again.";

let inflight: Promise<boolean> | null = null;

const withLock = <T,>(fn: () => Promise<T>): Promise<T> =>
  typeof navigator !== "undefined" && navigator.locks?.request
    ? (navigator.locks.request("school-session-refresh", fn) as Promise<T>)
    : fn();

/* Returns true when a usable access token is in storage afterwards */
function refreshSession(staleRefreshToken: string): Promise<boolean> {
  if (inflight) return inflight;
  inflight = withLock(async () => {
    const current = sessionStore.get();
    if (!current) return false;
    /* Another tab refreshed while we waited for the lock */
    if (current.refreshToken !== staleRefreshToken) return true;

    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken: current.refreshToken })
    });
    const json = await res.json().catch(() => null);
    if (res.ok) {
      const d = json.data;
      const next: Session = {
        ...current,
        accessToken: d.accessToken,
        accessExpiresAt: Date.now() + d.expiresIn * 1000,
        refreshToken: d.refreshToken,
        user: { ...current.user, ...d.user }
      };
      sessionStore.set(next);
      return true;
    }
    const message: string | undefined = json?.message;
    if (res.status === 401 && message && /just replaced/i.test(message)) {
      const latest = sessionStore.get();
      return !!latest && latest.refreshToken !== current.refreshToken;
    }
    if (res.status >= 400 && res.status < 500) {
      /* 401/403 explain why (signed out elsewhere, password changed); anything else is just a dead token */
      endSession(res.status === 401 || res.status === 403 ? message : SESSION_ENDED);
      return false;
    }
    throw toApiError(res, json);
  }).finally(() => {
    inflight = null;
  });
  return inflight;
}

/* Refresh shortly before the access token expires */
async function ensureFresh() {
  const s = sessionStore.get();
  if (s && s.accessExpiresAt - Date.now() < 30_000) await refreshSession(s.refreshToken);
}

/* ---- requests ---- */

export function buildUrl(path: string, query?: Query) {
  const url = new URL(BASE + path, window.location.origin);
  if (query)
    for (const [key, value] of Object.entries(query)) {
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) if (v !== undefined && v !== null && v !== "") url.searchParams.append(key, String(v));
    }
  return url.toString();
}

async function send(method: string, path: string, opts: RequestOptions): Promise<Response> {
  const auth = opts.auth !== false;
  const doFetch = () => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const session = sessionStore.get();
    if (auth && session) headers.Authorization = `Bearer ${session.accessToken}`;
    const year = opts.academicYearId === undefined ? academicYearId : opts.academicYearId;
    if (auth && year) headers["X-Academic-Year-Id"] = year;
    return fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal
    });
  };

  if (!auth) return doFetch();

  await ensureFresh();
  /* The refresh just ended the session (and said why): don't send a call without a token */
  if (!sessionStore.get()) throw new ApiError({ status: 401, code: "UNAUTHORIZED", message: SESSION_ENDED });
  let res = await doFetch();
  if (res.status === 401) {
    const session = sessionStore.get();
    if (!session) {
      endSession(SESSION_ENDED);
      return res;
    }
    if (await refreshSession(session.refreshToken)) {
      res = await doFetch();
      /* Still 401 after a good refresh: signed out remotely, password changed, deactivated */
      if (res.status === 401) {
        const err = await errorFromResponse(res.clone());
        endSession(err.message);
      }
    }
  }
  if (res.status === 403) emit({ type: "forbidden" });
  return res;
}

export async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<ApiResponse<T>> {
  const res = await send(method, path, opts);
  if (res.status === 204) return { data: undefined as T, message: "" };
  const json = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, json);
  return { data: json?.data as T, meta: json?.meta, message: json?.message ?? "" };
}

/* The file name from Content-Disposition, else the fallback */
function fileNameOf(res: Response, fallback: string) {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  return plain ? decodeSafely(plain[1]) : fallback;
}

/* Some exports send a percent-encoded plain filename ("Results%20Term%201.xlsx") */
function decodeSafely(name: string) {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const api = {
  get: <T,>(path: string, query?: Query, opts?: RequestOptions) => request<T>("GET", path, { ...opts, query }),
  post: <T,>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("POST", path, { ...opts, body }),
  patch: <T,>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PATCH", path, { ...opts, body }),
  put: <T,>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PUT", path, { ...opts, body }),
  delete: <T,>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, opts),
  /* multipart/form-data; the file goes in the "file" field */
  upload: <T,>(path: string, form: FormData, opts?: RequestOptions & { method?: "POST" | "PUT" }) =>
    request<T>(opts?.method ?? "POST", path, { ...opts, form }),

  /* Generated files (PDFs, exports, templates) need the bearer token, so fetch then save */
  async download(path: string, query?: Query, fallbackName = "download") {
    const res = await send("GET", path, { query });
    if (!res.ok) throw await errorFromResponse(res);
    saveBlob(await res.blob(), fileNameOf(res, fallbackName));
  },

  /* A generated file to show rather than save (a PDF opened in a new tab); POST sends a body */
  async blob(method: "GET" | "POST", path: string, opts: { query?: Query; body?: unknown } = {}) {
    const res = await send(method, path, opts);
    if (!res.ok) throw await errorFromResponse(res);
    return { blob: await res.blob(), fileName: fileNameOf(res, "download") };
  }
};

export { ApiError };
