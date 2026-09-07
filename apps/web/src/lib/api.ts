import { useAuthStore } from "@/store/auth";
import type { ApiErrorBody } from "@/lib/errorCodes";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:58000/api/v1";

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

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
  });

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
