import { create } from 'zustand';

interface CopilotPanelState {
  open: boolean;
  // Null until the first message of a new chat creates one.
  conversationId: string | null;
  setOpen(open: boolean): void;
  toggle(): void;
  setConversation(id: string | null): void;
}

export const useCopilotStore = create<CopilotPanelState>((set) => ({
  open: false,
  conversationId: null,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
  setConversation: (conversationId) => set({ conversationId }),
}));
