import { getApiBase } from "@/lib/serverConfig";
import { useAuthStore } from "@/store/auth";
import type { ApiErrorBody } from "@/lib/errorCodes";

export class ApiError extends Error {
  code: string;
  details: Record<string, unknown>;
  retryable: boolean;
  status: number;
  requestId?: string;
  traceId?: string;

  constructor(status: number, body: ApiErrorBody, requestId?: string, traceId?: string) {
    super(body.error.message);
    this.status = status;
    this.code = body.error.code;
    this.details = body.error.details;
    this.retryable = body.error.retryable;
    this.requestId = requestId;
    this.traceId = traceId;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  isFormData?: boolean;
  idempotencyKey?: string;
  auth?: boolean;
}

function generateHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, isFormData = false, idempotencyKey, auth = true } = options;

  // Generate W3C traceparent & request ID for end-to-end distributed tracing
  const traceId = generateHex(32);
  const spanId = generateHex(16);
  const requestId = `req_${generateHex(12)}`;

  const headers: Record<string, string> = {
    "X-Request-ID": requestId,
    traceparent: `00-${traceId}-${spanId}-01`,
  };

  if (!isFormData) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  if (auth) {
    const token = useAuthStore.getState().accessToken;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const apiBase = getApiBase();
  const startTime = performance.now();
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
    throw new ApiError(
      0,
      {
        error: {
          code: "NETWORK_ERROR",
          message: `Could not reach the MaterialOS server at ${apiBase}. Check your server settings.`,
          details: { apiBase },
          retryable: true,
        },
      },
      requestId,
      traceId
    );
  }

  const durationMs = Math.round(performance.now() - startTime);
  const serverRequestId = res.headers.get("X-Request-ID") || requestId;
  const serverTraceId = res.headers.get("X-Trace-ID") || traceId;

  // Log telemetry for slow network queries (> 2000ms)
  if (durationMs > 2000) {
    console.warn(`[Telemetry Slow Query] ${method} ${path} took ${durationMs}ms (Trace ID: ${serverTraceId})`);
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
    throw new ApiError(res.status, errorBody, serverRequestId, serverTraceId);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Downloads an auth-gated file (a homework/announcement attachment,
 * an admission document) straight to disk -- a plain `<a href>` can't
 * carry the Authorization header these endpoints require, so this
 * fetches as a blob and triggers the save via a throwaway anchor,
 * same "fetch as blob, revoke after" shape as useAuthenticatedImage. */
export async function downloadAuthenticatedFile(path: string, fileName: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${getApiBase()}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
