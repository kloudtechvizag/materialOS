import { isTauri } from "@tauri-apps/api/core";

export function isDesktopApp(): boolean {
  try {
    if (typeof window !== "undefined") {
      if (window.location.search.includes("desktop=true") || window.location.pathname.startsWith("/desktop")) {
        return true;
      }
    }
    return isTauri();
  } catch {
    return false;
  }
}

export function getClientPlatform(): "macos" | "windows" | "linux" | "web" {
  if (typeof window === "undefined" || !navigator) return "web";
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("mac")) return "macos";
  if (userAgent.includes("win")) return "windows";
  if (userAgent.includes("linux")) return "linux";
  return "web";
}

export async function minimizeDesktopWindow(): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  } catch (err) {
    console.warn("Failed to minimize window:", err);
  }
}

export async function toggleMaximizeDesktopWindow(): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  } catch (err) {
    console.warn("Failed to toggle maximize window:", err);
  }
}

export async function closeDesktopWindow(): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch (err) {
    console.warn("Failed to close window:", err);
  }
}
