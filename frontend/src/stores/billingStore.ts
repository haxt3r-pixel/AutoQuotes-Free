import { create } from 'zustand';
import { api } from '../api/client';
import type { BillingTicket } from '../types';

interface BillingState {
  tickets: BillingTicket[];
  currentTicket: BillingTicket | null;
  isLoading: boolean;
  error: string | null;
  loadTickets: (status?: string, search?: string) => Promise<void>;
  loadTicket: (id: number) => Promise<void>;
  markPaid: (id: number, payment_note?: string | null) => Promise<BillingTicket | null>;
  voidTicket: (id: number, payment_note?: string | null) => Promise<BillingTicket | null>;
  clearCurrent: () => void;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  tickets: [],
  currentTicket: null,
  isLoading: false,
  error: null,

  loadTickets: async (status, search) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search?.trim()) params.set('search', search.trim());
      const query = params.size ? `?${params.toString()}` : '';
      const res = await api.get<BillingTicket[]>(`/billing${query}`);
      if (res.success) set({ tickets: res.data, isLoading: false });
      else set({ error: res.message || 'Failed to load billing tickets', isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  loadTicket: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<BillingTicket>(`/billing/${id}`);
      if (res.success) set({ currentTicket: res.data, isLoading: false });
      else set({ error: res.message || 'Ticket not found', isLoading: false, currentTicket: null });
    } catch (err: any) {
      set({ error: err.message, isLoading: false, currentTicket: null });
    }
  },

  markPaid: async (id, payment_note) => {
    try {
      const res = await api.post<BillingTicket>(`/billing/${id}/pay`, {
        payment_note: payment_note ?? null,
      });
      if (!res.success) {
        set({ error: res.message || 'Failed to mark paid' });
        return null;
      }
      set({
        currentTicket: res.data,
        tickets: get().tickets.map(t => (t.id === id ? res.data : t)),
      });
      return res.data;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  voidTicket: async (id, payment_note) => {
    try {
      const res = await api.post<BillingTicket>(`/billing/${id}/void`, {
        payment_note: payment_note ?? null,
      });
      if (!res.success) {
        set({ error: res.message || 'Failed to void ticket' });
        return null;
      }
      set({
        currentTicket: res.data,
        tickets: get().tickets.map(t => (t.id === id ? res.data : t)),
      });
      return res.data;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  clearCurrent: () => set({ currentTicket: null, error: null }),
}));
