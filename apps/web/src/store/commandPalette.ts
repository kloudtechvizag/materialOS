import { create } from "zustand";

interface CommandPaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/** Not persisted -- always closed on load, same as sidebar's mobileOpen.
 * Shared so both CommandPalette's own Ctrl+K listener and the header's
 * clickable search button drive the same dialog instance. */
export const useCommandPaletteStore = create<CommandPaletteState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
}));
