export type ErrorDetail = { location?: string; field: string; message: string };

/* Every non-2xx response from the API, with the backend's error envelope */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];
  readonly requestId?: string;
  /* seconds, from Retry-After on 429 */
  readonly retryAfter?: number;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: ErrorDetail[];
    requestId?: string;
    retryAfter?: number;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId;
    this.retryAfter = init.retryAfter;
  }

  get isValidation() {
    return this.code === "VALIDATION_ERROR";
  }

  /* { "user.email": "must be a valid email" } — the first message per field */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details) if (d.field && !out[d.field]) out[d.field] = d.message;
    return out;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/* A message fit to show a person, whatever was thrown */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.status === 403) return e.message || "You don't have access to this.";
    if (e.status >= 500) return "Something went wrong. Please try again.";
    return e.message;
  }
  if (e instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

export async function errorFromResponse(res: Response): Promise<ApiError> {
  const json = await res.json().catch(() => null);
  return toApiError(res, json);
}

export function toApiError(res: Response, json: unknown): ApiError {
  const body = (json ?? {}) as {
    message?: string;
    error?: { code?: string; requestId?: string; details?: ErrorDetail[] };
  };
  const retry = Number(res.headers.get("Retry-After"));
  return new ApiError({
    status: res.status,
    code: body.error?.code ?? (res.status >= 500 ? "INTERNAL_ERROR" : "HTTP_" + res.status),
    message: body.message ?? res.statusText ?? "Request failed",
    details: body.error?.details,
    requestId: body.error?.requestId ?? res.headers.get("X-Request-Id") ?? undefined,
    retryAfter: Number.isFinite(retry) && retry > 0 ? retry : undefined
  });
}
