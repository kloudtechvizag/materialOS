import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";

import { checkForDesktopUpdate, installDesktopUpdate, isDesktop } from "@/lib/desktopUpdater";

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const SKIPPED_VERSION_KEY = "materialos.updater.skipped_version";
const TOAST_ID = "desktop-update";

/** Background update check for the desktop app -- mounted once in
 * AppShell, renders nothing itself. No-ops entirely on web (isDesktop()
 * false). Checks on mount and every 4h; never nags about a version the
 * user already dismissed with "Later". The actual restart only ever
 * happens from the user's own "Update Now" click, so a check landing
 * mid-workflow can't interrupt anything -- see desktopUpdater.ts. */
export function DesktopUpdateNotifier() {
  const checkingRef = useRef(false);

  useEffect(() => {
    if (!isDesktop()) return;

    async function beginInstall(update: Update) {
      let total = 0;
      let received = 0;
      let lastPct = -1;

      toast.loading("Downloading MaterialOS update...", { id: TOAST_ID, duration: Infinity });

      function onProgress(event: DownloadEvent) {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          received += event.data.chunkLength;
          const pct = total ? Math.round((received / total) * 100) : undefined;
          if (pct !== undefined && pct !== lastPct) {
            lastPct = pct;
            toast.loading(`Downloading MaterialOS update... ${pct}%`, { id: TOAST_ID, duration: Infinity });
          }
        }
      }

      try {
        await installDesktopUpdate(update, onProgress);
        toast.success("Update installed -- restarting MaterialOS...", { id: TOAST_ID });
      } catch {
        toast.error("Couldn't install the update. MaterialOS will offer it again next time.", { id: TOAST_ID });
      }
    }

    function offerUpdate(update: Update) {
      const skippedVersion = localStorage.getItem(SKIPPED_VERSION_KEY);
      if (skippedVersion === update.version) return;

      toast(`MaterialOS ${update.version} is available`, {
        id: TOAST_ID,
        description: update.body ? update.body.slice(0, 200) : "A new version is ready to install.",
        duration: Infinity,
        action: { label: "Update Now", onClick: () => beginInstall(update) },
        cancel: { label: "Later", onClick: () => localStorage.setItem(SKIPPED_VERSION_KEY, update.version) },
      });
    }

    async function runCheck() {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        const update = await checkForDesktopUpdate();
        if (update) offerUpdate(update);
      } finally {
        checkingRef.current = false;
      }
    }

    runCheck();
    const interval = setInterval(runCheck, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return null;
}
