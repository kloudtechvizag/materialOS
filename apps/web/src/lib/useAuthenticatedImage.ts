import { useEffect, useState } from "react";

import { getApiBase } from "@/lib/serverConfig";
import { useAuthStore } from "@/store/auth";

/** Fetches an auth-gated image (e.g. an item's photo) as a blob and
 * hands back a local object: URL a plain <img> can use -- a bare
 * `<img src="/api/v1/items/{id}/image">` can't carry the Authorization
 * header the API requires. Returns null while loading or when there's
 * no path to fetch; the caller renders its own fallback (icon) in both
 * of those cases, same as an image that 404s.
 *
 * `cacheKey` should be some value that changes when the underlying
 * image does (e.g. the record's own image_path) -- the fetch URL
 * itself is usually stable (same /items/{id}/image endpoint before and
 * after a re-upload), so without this the effect has no way to know a
 * refetch is needed after the list query invalidates and refetches. */
export function useAuthenticatedImage(path: string | null, cacheKey?: string | null): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setObjectUrl(null);
      return;
    }

    let cancelled = false;
    let localUrl: string | null = null;
    const token = useAuthStore.getState().accessToken;

    const cleanPath = path.startsWith("/api/v1") ? path.slice(7) : path;
    fetch(`${getApiBase()}${cleanPath}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        localUrl = URL.createObjectURL(blob);
        setObjectUrl(localUrl);
      })
      .catch(() => {
        // A failed fetch (offline, 404) just means no image -- the
        // caller's fallback icon covers this, not an error state.
      });

    return () => {
      cancelled = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [path, cacheKey]);

  return objectUrl;
}
