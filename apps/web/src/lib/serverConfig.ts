/** The desktop app's API address used to be baked into the JS bundle
 * at build time (import.meta.env.VITE_API_BASE_URL, resolved once by
 * Vite and frozen forever into the shipped binary) -- fine for a web
 * deploy with one known backend, wrong for a downloadable desktop app
 * with no backend of its own. There is no hosted MaterialOS server;
 * every user runs their own backend (`docker-compose up`, see the
 * README) and needs to point their own copy of the app at it. This
 * makes that address a runtime setting instead, stored per-viewer in
 * localStorage, editable from /server-settings (reachable from the
 * Login/Signup pages, since you can't get past login to a normal
 * Settings page if the server address itself is wrong).
 */

const STORAGE_KEY = "materialos.api_base_url";
const BUILT_IN_DEFAULT = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:58000/api/v1";

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function defaultApiBase(): string {
  return BUILT_IN_DEFAULT;
}

export function getApiBase(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage unavailable -- fall through to the built-in default.
  }
  return BUILT_IN_DEFAULT;
}

export function setApiBase(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, normalize(url));
  } catch {
    // Best-effort persistence; the in-memory default still works for this session.
  }
}

export function resetApiBase(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}

export function isCustomApiBase(): boolean {
  return getApiBase() !== BUILT_IN_DEFAULT;
}

/** Real reachability check against /health/live (no auth, no DB
 * dependency) -- used by the Server Settings screen before a user
 * saves an address, so a typo shows up immediately rather than as a
 * confusing failure on the next login attempt. */
export async function testServerConnection(url: string): Promise<{ ok: boolean; message: string }> {
  const base = normalize(url);
  if (!base) return { ok: false, message: "Enter a server address first." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${base}/health/live`, { signal: controller.signal });
    if (res.ok) return { ok: true, message: "Connected." };
    return { ok: false, message: `Server responded with HTTP ${res.status}.` };
  } catch {
    return { ok: false, message: "Could not reach this address. Check the URL, that the server is running, and your network connection." };
  } finally {
    clearTimeout(timeout);
  }
}
