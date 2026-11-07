import { create } from 'zustand';
import { api } from '../api/client';
import type { QuoteHeader, LineItem, CategorizedItem, JobSummaryRef } from '../types';

interface QuoteState {
  // Current quote
  currentQuote: QuoteHeader | null;
  lineItems: LineItem[];
  isLoading: boolean;
  error: string | null;

  // Quote list
  quotes: QuoteHeader[];

  // Actions
  loadQuotes: (status?: string, search?: string) => Promise<void>;
  createQuote: (overrides?: Record<string, unknown>) => Promise<QuoteHeader | null>;
  loadQuote: (id: number) => Promise<void>;
  updateQuote: (id: number, data: Record<string, unknown>) => Promise<QuoteHeader | null>;
  updateStatus: (id: number, status: string) => Promise<JobSummaryRef | null>;
  deleteQuote: (id: number, confirmed?: boolean) => Promise<boolean>;

  // Line items
  addLineItem: (data: Record<string, unknown>) => Promise<void>;
  updateLineItem: (itemId: number, data: Record<string, unknown>) => Promise<void>;
  removeLineItem: (itemId: number) => Promise<void>;
  setItemPriority: (itemId: number, priority: string) => Promise<void>;
  setItemExplanation: (itemId: number, explanation: string) => Promise<void>;
  applyCategorization: (categorized: CategorizedItem[]) => void;
  recalculateTotals: () => Promise<void>;
}

export const useQuoteStore = create<QuoteState>((set, get) => ({
  currentQuote: null,
  lineItems: [],
  isLoading: false,
  error: null,
  quotes: [],

  loadQuotes: async (status, search) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search?.trim()) params.set('search', search.trim());
      const query = params.size ? `?${params.toString()}` : '';
      const res = await api.get<QuoteHeader[]>(`/quotes${query}`);
      if (res.success) {
        set({ quotes: res.data, isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createQuote: async (overrides) => {
    set({ isLoading: true });
    try {
      const res = await api.post<QuoteHeader>('/quotes', overrides);
      if (res.success) {
        set({
          currentQuote: res.data,
          lineItems: [],
          isLoading: false,
          quotes: [res.data, ...get().quotes],
        });
        return res.data;
      }
      set({ error: 'Failed to create quote', isLoading: false });
      return null;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return null;
    }
  },

  loadQuote: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<{ header: QuoteHeader; items: LineItem[] }>(`/quotes/${id}`);
      if (res.success) {
        set({
          currentQuote: res.data.header,
          lineItems: res.data.items,
          isLoading: false,
        });
      } else {
        set({ currentQuote: null, lineItems: [], error: res.message || 'Failed to load quote', isLoading: false });
      }
    } catch (err: any) {
      set({ currentQuote: null, lineItems: [], error: err.message, isLoading: false });
    }
  },

  updateQuote: async (id, data) => {
    set({ error: null });
    try {
      const res = await api.put<QuoteHeader>(`/quotes/${id}`, data);
      if (res.success) {
        if (get().currentQuote?.id === id) set({ currentQuote: res.data });
        set({ quotes: get().quotes.map(q => q.id === id ? { ...q, ...res.data } : q) });
        return res.data;
      }
      set({ error: res.message || 'Failed to save quote' });
    } catch (err: any) {
      set({ error: err.message });
    }
    return null;
  },

  updateStatus: async (id, status) => {
    try {
      const res = await api.put<{
        quote: QuoteHeader;
        job: JobSummaryRef | null;
      } | QuoteHeader>(`/quotes/${id}/status`, { status });

      if (!res.success) {
        set({ error: res.message || 'Failed to update status' });
        return null;
      }

      // Support both new { quote, job } payload and legacy bare quote
      const payload = res.data as any;
      const quote: QuoteHeader = payload?.quote ?? payload;
      const job: JobSummaryRef | null = payload?.job ?? null;

      if (get().currentQuote?.id === id) {
        set({ currentQuote: { ...get().currentQuote!, ...quote, status: quote.status } });
      }
      set({
        quotes: get().quotes.map(q => (q.id === id ? { ...q, ...quote } : q)),
      });
      return job;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  deleteQuote: async (id, confirmed = false) => {
    try {
      const suffix = confirmed ? '?confirmed=true' : '';
      const res = await api.delete(`/quotes/${id}${suffix}`);
      if (!res.success) {
        set({ error: res.message || 'Failed to delete quote' });
        return false;
      }
      set({
        quotes: get().quotes.filter(q => q.id !== id),
        currentQuote: get().currentQuote?.id === id ? null : get().currentQuote,
        lineItems: get().currentQuote?.id === id ? [] : get().lineItems,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  addLineItem: async (data) => {
    const quoteId = get().currentQuote?.id;
    if (!quoteId) return;
    set({ error: null });
    try {
      const res = await api.post<LineItem>(`/quotes/${quoteId}/items`, data);
      if (!res.success) throw new Error(res.message || 'Failed to add item');
      await get().loadQuote(quoteId);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateLineItem: async (itemId, data) => {
    const quoteId = get().currentQuote?.id;
    if (!quoteId) return;
    set({ error: null });
    try {
      const res = await api.put(`/quotes/${quoteId}/items/${itemId}`, data);
      if (!res.success) throw new Error(res.message || 'Failed to update item');
      await get().loadQuote(quoteId);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  removeLineItem: async (itemId) => {
    const quoteId = get().currentQuote?.id;
    if (!quoteId) return;
    set({ error: null });
    try {
      const res = await api.delete(`/quotes/${quoteId}/items/${itemId}`);
      if (!res.success) throw new Error(res.message || 'Failed to remove item');
      await get().loadQuote(quoteId);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  recalculateTotals: async () => {
    const quoteId = get().currentQuote?.id;
    if (!quoteId) return;
    set({ error: null });
    try {
      const res = await api.post<{ header: QuoteHeader; items: LineItem[] }>(`/quotes/${quoteId}/recalculate`);
      if (res.success) {
        set({
          currentQuote: res.data.header,
          lineItems: res.data.items,
        });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  setItemPriority: async (itemId, priority) => {
    const quoteId = get().currentQuote?.id;
    if (!quoteId) return;
    try {
      await api.put(`/quotes/${quoteId}/items/${itemId}/priority`, { priority });
      set({
        lineItems: get().lineItems.map(i =>
          i.id === itemId ? { ...i, priority: priority as LineItem['priority'] } : i,
        ),
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  setItemExplanation: async (itemId, explanation) => {
    const quoteId = get().currentQuote?.id;
    if (!quoteId) return;
    try {
      await api.put(`/quotes/${quoteId}/items/${itemId}/explanation`, { explanation });
      set({
        lineItems: get().lineItems.map(i =>
          i.id === itemId ? { ...i, ai_explanation: explanation } : i,
        ),
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  applyCategorization: (categorized) => {
    const items = [...get().lineItems];
    for (const cat of categorized) {
      if (cat.index < items.length) {
        items[cat.index] = { ...items[cat.index], priority: cat.category };
      }
    }
    set({ lineItems: items });
    // Persist to backend
    for (const cat of categorized) {
      if (cat.index < items.length) {
        get().setItemPriority(items[cat.index].id, cat.category);
      }
    }
  },
}));