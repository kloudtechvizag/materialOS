import { useState, useEffect } from "react";
import { Minus, Square, X } from "lucide-react";
import {
  isDesktopApp,
  getClientPlatform,
  minimizeDesktopWindow,
  toggleMaximizeDesktopWindow,
  closeDesktopWindow,
} from "@/lib/desktopWindow";

export function DesktopWindowControls() {
  const [isTauri, setIsTauri] = useState(false);
  const [platform, setPlatform] = useState<"macos" | "windows" | "linux" | "web">("web");

  useEffect(() => {
    setIsTauri(isDesktopApp());
    setPlatform(getClientPlatform());
  }, []);

  if (!isTauri) return null;

  if (platform === "macos") {
    return (
      <div className="flex items-center gap-2 px-2 no-drag" aria-label="macOS Window Controls">
        <button
          type="button"
          onClick={closeDesktopWindow}
          aria-label="Close"
          className="group relative flex h-3 w-3 items-center justify-center rounded-full bg-[#ff5f56] hover:brightness-90 transition-all"
        >
          <X className="h-2 w-2 text-[#4d0000] opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          type="button"
          onClick={minimizeDesktopWindow}
          aria-label="Minimize"
          className="group relative flex h-3 w-3 items-center justify-center rounded-full bg-[#ffbd2e] hover:brightness-90 transition-all"
        >
          <Minus className="h-2 w-2 text-[#5c3c00] opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          type="button"
          onClick={toggleMaximizeDesktopWindow}
          aria-label="Zoom"
          className="group relative flex h-3 w-3 items-center justify-center rounded-full bg-[#27c93f] hover:brightness-90 transition-all"
        >
          <Square className="h-1.5 w-1.5 text-[#004d00] opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    );
  }

  // Windows / Linux Controls
  return (
    <div className="flex items-center no-drag" aria-label="Window Controls">
      <button
        type="button"
        onClick={minimizeDesktopWindow}
        aria-label="Minimize"
        className="flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={toggleMaximizeDesktopWindow}
        aria-label="Maximize / Restore"
        className="flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
      >
        <Square className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={closeDesktopWindow}
        aria-label="Close"
        className="flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
