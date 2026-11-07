import { create } from 'zustand';
import { api } from '../api/client';
import type { AiStatus, CategorizedItem, ScrapedPart } from '../types';

interface AiState {
  // Connection state
  status: AiStatus | null;
  isChecking: boolean;
  isProcessing: boolean;
  lastError: string | null;

  // Explanation cache: key = item description hash
  explanationCache: Record<string, string>;

  // Parts search
  searchParts: (query: string, opts?: {
    vendors?: string[];
    vehicleContext?: string;
    vehicle?: { year?: number | null; make?: string | null; model?: string | null; engine?: string | null };
    zipCode?: string;
  }) => Promise<ScrapedPart[]>;

  // Actions
  checkStatus: () => Promise<AiStatus | null>;
  testConnection: () => Promise<{ ok: boolean; models: string[]; error?: string }>;
  pollStatus: () => void;
  stopPolling: () => void;

  polishNote: (text: string) => Promise<string | null>;
  explainPart: (description: string, vehicle?: string) => Promise<string | null>;
  categorizeItems: (items: { index: number; description: string; cost: number }[], notes?: string) => Promise<CategorizedItem[] | null>;
  draftEmail: (params: {
    customerName: string;
    vehicleInfo: string;
    quoteSummary: string;
    shopName: string;
    tone?: 'professional' | 'friendly';
  }) => Promise<string | null>;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export const useAiStore = create<AiState>((set, get) => ({
  status: null,
  isChecking: false,
  isProcessing: false,
  lastError: null,
  explanationCache: {},

  checkStatus: async () => {
    set({ isChecking: true });
    try {
      const res = await api.get<AiStatus>('/ai/status');
      if (res.success) {
        set({ status: res.data, lastError: null, isChecking: false });
        return res.data;
      }
      set({ lastError: res.message || 'Unknown error', isChecking: false });
      return null;
    } catch (err: any) {
      set({ lastError: err.message, isChecking: false });
      return null;
    }
  },

  testConnection: async () => {
    set({ isChecking: true });
    try {
      const res = await api.post<{ connected: boolean; models: string[]; error?: string }>('/ai/test-connection');
      if (res.success && res.data.connected) {
        set({ lastError: null, isChecking: false });
        return { ok: true, models: res.data.models };
      }
      set({
        lastError: res.data.error || 'Connection failed',
        isChecking: false,
      });
      return { ok: false, models: [], error: res.data.error };
    } catch (err: any) {
      set({ lastError: err.message, isChecking: false });
      return { ok: false, models: [], error: err.message };
    }
  },

  pollStatus: () => {
    get().stopPolling();
    get().checkStatus();
    pollTimer = setInterval(() => {
      get().checkStatus();
    }, 30_000);
  },

  stopPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  },

  polishNote: async (text: string) => {
    set({ isProcessing: true, lastError: null });
    try {
      const res = await api.post<{ original: string; polished: string }>('/ai/polish-note', { text });
      if (res.success) {
        set({ isProcessing: false });
        return res.data.polished;
      }
      set({ lastError: res.message || 'Failed to polish text', isProcessing: false });
      return null;
    } catch (err: any) {
      set({ lastError: err.message, isProcessing: false });
      return null;
    }
  },

  explainPart: async (description: string, vehicle?: string) => {
    // Check cache first
    const cacheKey = `${description}::${vehicle || ''}`;
    const cached = get().explanationCache[cacheKey];
    if (cached) return cached;

    set({ isProcessing: true, lastError: null });
    try {
      const res = await api.post<{ explanation: string }>('/ai/explain-part', { description, vehicle });
      if (res.success) {
        set({
          isProcessing: false,
          explanationCache: { ...get().explanationCache, [cacheKey]: res.data.explanation },
        });
        return res.data.explanation;
      }
      set({ lastError: res.message || 'Failed to generate explanation', isProcessing: false });
      return null;
    } catch (err: any) {
      set({ lastError: err.message, isProcessing: false });
      return null;
    }
  },

  categorizeItems: async (items, notes?) => {
    set({ isProcessing: true, lastError: null });
    try {
      const res = await api.post<{ categorized: CategorizedItem[] }>('/ai/categorize', { items, notes });
      if (res.success) {
        set({ isProcessing: false });
        return res.data.categorized;
      }
      set({ lastError: res.message || 'Failed to categorize items', isProcessing: false });
      return null;
    } catch (err: any) {
      set({ lastError: err.message, isProcessing: false });
      return null;
    }
  },

  draftEmail: async (params) => {
    set({ isProcessing: true, lastError: null });
    try {
      const res = await api.post<{ email: string }>('/ai/draft-email', params);
      if (res.success) {
        set({ isProcessing: false });
        return res.data.email;
      }
      set({ lastError: res.message || 'Failed to draft email', isProcessing: false });
      return null;
    } catch (err: any) {
      set({ lastError: err.message, isProcessing: false });
      return null;
    }
  },

  searchParts: async (query, opts) => {
    set({ isProcessing: true, lastError: null });
    try {
      const res = await api.post<ScrapedPart[]>('/parts/search', { query, ...opts });
      if (res.success) {
        set({ isProcessing: false });
        return res.data;
      }
      set({ lastError: res.message || 'Parts search failed', isProcessing: false });
      return [];
    } catch (err: any) {
      set({ lastError: err.message, isProcessing: false });
      return [];
    }
  },
}));