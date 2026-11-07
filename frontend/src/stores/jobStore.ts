import { create } from 'zustand';
import { api } from '../api/client';
import type { FullJob, JobHeader, JobLineItem, BillingTicket, JobStatus } from '../types';

interface JobState {
  jobs: JobHeader[];
  currentJob: FullJob | null;
  isLoading: boolean;
  error: string | null;
  loadJobs: (status?: string, search?: string) => Promise<void>;
  loadJob: (id: number) => Promise<void>;
  updateJob: (id: number, data: {
    status?: Exclude<JobStatus, 'completed'>;
    mechanic_notes?: string | null;
    completion_notes?: string | null;
  }) => Promise<JobHeader | null>;
  updateItem: (jobId: number, itemId: number, data: {
    is_done?: boolean;
    mechanic_note?: string | null;
  }) => Promise<void>;
  completeJob: (id: number, completion_notes?: string | null) => Promise<{
    job: FullJob;
    ticket: BillingTicket;
  } | null>;
  deleteJob: (id: number, confirmed?: boolean) => Promise<boolean>;
  clearCurrent: () => void;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  currentJob: null,
  isLoading: false,
  error: null,

  loadJobs: async (status, search) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search?.trim()) params.set('search', search.trim());
      const query = params.size ? `?${params.toString()}` : '';
      const res = await api.get<JobHeader[]>(`/jobs${query}`);
      if (res.success) set({ jobs: res.data, isLoading: false });
      else set({ error: res.message || 'Failed to load jobs', isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  loadJob: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<FullJob>(`/jobs/${id}`);
      if (res.success) set({ currentJob: res.data, isLoading: false });
      else set({ error: res.message || 'Job not found', isLoading: false, currentJob: null });
    } catch (err: any) {
      set({ error: err.message, isLoading: false, currentJob: null });
    }
  },

  updateJob: async (id, data) => {
    try {
      const res = await api.put<JobHeader>(`/jobs/${id}`, data);
      if (!res.success) {
        set({ error: res.message || 'Failed to update job' });
        return null;
      }
      const current = get().currentJob;
      if (current?.header.id === id) {
        set({ currentJob: { ...current, header: { ...current.header, ...res.data } } });
      }
      set({ jobs: get().jobs.map(j => (j.id === id ? { ...j, ...res.data } : j)) });
      return res.data;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  updateItem: async (jobId, itemId, data) => {
    try {
      const res = await api.put<{ item: JobLineItem; job: FullJob }>(
        `/jobs/${jobId}/items/${itemId}`,
        data,
      );
      if (res.success) {
        set({ currentJob: res.data.job });
        const h = res.data.job.header;
        set({ jobs: get().jobs.map(j => (j.id === jobId ? { ...j, ...h } : j)) });
      } else {
        set({ error: res.message || 'Failed to update checklist item' });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  completeJob: async (id, completion_notes) => {
    try {
      const res = await api.post<{ job: FullJob; ticket: BillingTicket }>(
        `/jobs/${id}/complete`,
        { completion_notes: completion_notes ?? null },
      );
      if (!res.success) {
        set({ error: res.message || 'Failed to complete job' });
        return null;
      }
      set({
        currentJob: res.data.job,
        jobs: get().jobs.map(j => (j.id === id ? { ...j, ...res.data.job.header } : j)),
      });
      return res.data;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  deleteJob: async (id, confirmed = false) => {
    try {
      const suffix = confirmed ? '?confirmed=true' : '';
      const res = await api.delete(`/jobs/${id}${suffix}`);
      if (!res.success) {
        set({ error: res.message || 'Failed to delete job' });
        return false;
      }
      set({
        jobs: get().jobs.filter(job => job.id !== id),
        currentJob: get().currentJob?.header.id === id ? null : get().currentJob,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  clearCurrent: () => set({ currentJob: null, error: null }),
}));
