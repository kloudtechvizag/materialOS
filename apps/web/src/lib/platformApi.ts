import { ApiError } from "@/lib/api";
import { getApiBase } from "@/lib/serverConfig";
import type { ApiErrorBody } from "@/lib/errorCodes";
import { usePlatformAuthStore } from "@/store/platformAuth";

interface PlatformRequestOptions {
  method?: string;
  body?: unknown;
}

/** apiFetch's twin for the platform admin console -- attaches the
 * platform token (usePlatformAuthStore), never the tenant one. Kept as
 * a separate function rather than an `auth store` param on apiFetch so
 * there is no code path where the two could be swapped by mistake. */
export async function platformFetch<T>(path: string, options: PlatformRequestOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = usePlatformAuthStore.getState().accessToken;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const apiBase = getApiBase();
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, {
      error: {
        code: "NETWORK_ERROR",
        message: `Could not reach the MaterialOS server at ${apiBase}.`,
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
