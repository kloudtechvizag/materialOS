import { getApiBase } from "@/lib/serverConfig";
import { useAuthStore } from "@/store/auth";
import type { ApiErrorBody } from "@/lib/errorCodes";

export class ApiError extends Error {
  code: string;
  details: Record<string, unknown>;
  retryable: boolean;
  status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.status = status;
    this.code = body.error.code;
    this.details = body.error.details;
    this.retryable = body.error.retryable;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  isFormData?: boolean;
  idempotencyKey?: string;
  auth?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, isFormData = false, idempotencyKey, auth = true } = options;

  const headers: Record<string, string> = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  if (auth) {
    const token = useAuthStore.getState().accessToken;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const apiBase = getApiBase();
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    // fetch() itself throws (connection refused, DNS failure, offline)
    // rather than resolving with a non-ok Response -- without this,
    // that propagated as a raw, uncaught TypeError every caller's
    // `err instanceof ApiError` check failed to recognize, falling
    // back to a generic "Something went wrong"-style message that
    // gave no hint the real problem was an unreachable server address.
    throw new ApiError(0, {
      error: {
        code: "NETWORK_ERROR",
        message: `Could not reach the MaterialOS server at ${apiBase}. Check your server settings.`,
        details: { apiBase },
        retryable: true,
      },
    });
  }

  if (!res.ok) {
    let errorBody: ApiErrorBody;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = {
        error: { code: "INTERNAL_ERROR", message: `Request failed with status ${res.status}`, details: {}, retryable: true },
      };
    }
    throw new ApiError(res.status, errorBody);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
