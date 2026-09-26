import { create } from "zustand";

interface AiCopilotState {
  isOpen: boolean;
  activePrompt: string;
  openCopilot: (prompt?: string) => void;
  closeCopilot: () => void;
  toggleCopilot: () => void;
  setActivePrompt: (prompt: string) => void;
  dispatchPrompt: (prompt: string) => void;
}

/** Reactive Zustand store managing AI Copilot HUD open/close lifecycle
 * and programmatic prompt dispatch across MaterialOS. */
export const useAiCopilotStore = create<AiCopilotState>((set, get) => ({
  isOpen: false,
  activePrompt: "",
  openCopilot: (prompt) => set({ isOpen: true, activePrompt: prompt ?? get().activePrompt }),
  closeCopilot: () => set({ isOpen: false }),
  toggleCopilot: () => set({ isOpen: !get().isOpen }),
  setActivePrompt: (activePrompt) => set({ activePrompt }),
  dispatchPrompt: (prompt) => set({ isOpen: true, activePrompt: prompt }),
}));
