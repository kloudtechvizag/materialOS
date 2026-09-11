import { isTauri } from "@tauri-apps/api/core";
import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";

/** True only inside the Tauri desktop webview -- the web build (browser,
 * no Tauri runtime) must no-op every function below rather than throw. */
export function isDesktop(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

/** Checks the signed manifest at tauri.conf.json's plugins.updater.endpoints
 * (a `latest.json` published alongside every GitHub Release -- see
 * .github/workflows/desktop-release.yml). Returns null when already on the
 * latest version, offline, or running on the web. Never throws -- a failed
 * check should be invisible to the user, not an error dialog. */
export async function checkForDesktopUpdate(): Promise<Update | null> {
  if (!isDesktop()) return null;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    return await check();
  } catch {
    return null;
  }
}

/** Downloads and installs the given update, then relaunches. The restart
 * only ever happens from this explicit call (user clicked "Update Now") --
 * MaterialOS never restarts itself unprompted, so it can never interrupt
 * whatever the user is doing. */
export async function installDesktopUpdate(update: Update, onProgress?: (event: DownloadEvent) => void): Promise<void> {
  await update.downloadAndInstall(onProgress);
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
