import { create } from 'zustand';
import { api } from '../api/client';
import type { ShopProfile } from '../types';

interface SettingsState {
  settings: Record<string, unknown>;
  profile: ShopProfile | null;
  isLoading: boolean;
  error: string | null;

  loadSettings: () => Promise<void>;
  loadProfile: () => Promise<void>;
  updateSettings: (updates: Record<string, unknown>) => Promise<void>;
  updateProfile: (updates: Partial<ShopProfile>) => Promise<void>;
  uploadLogo: (file: File) => Promise<string | null>;
  getTyped: <T>(key: string, fallback: T) => T;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  profile: null,
  isLoading: false,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<Record<string, unknown>>('/settings');
      if (res.success) {
        set({ settings: res.data, isLoading: false });
      } else {
        set({ error: res.message || 'Failed to load settings', isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  loadProfile: async () => {
    try {
      const res = await api.get<ShopProfile>('/settings/profile/data');
      if (res.success) {
        set({ profile: res.data });
      }
    } catch (err: any) {
      console.error('[Settings] Failed to load profile:', err.message);
    }
  },

  updateSettings: async (updates) => {
    try {
      const res = await api.put<Record<string, unknown>>('/settings', updates);
      if (res.success) {
        set({ settings: { ...get().settings, ...res.data } });
        return;
      }
      throw new Error(res.message || 'Failed to update settings');
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateProfile: async (updates) => {
    try {
      const res = await api.put<ShopProfile>('/settings/profile/data', updates);
      if (res.success) {
        set({ profile: res.data });
        return;
      }
      throw new Error(res.message || 'Failed to update shop profile');
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  uploadLogo: async (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const response = await fetch('/api/settings/logo', {
        method: 'POST',
        body: formData,
      });
      const json = await response.json();
      if (json.success) {
        set({ profile: { ...get().profile!, logo_path: json.data.logo_path } });
        return json.data.logo_path;
      }
      return null;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  getTyped: <T>(key: string, fallback: T): T => {
    const value = get().settings[key];
    if (value === undefined || value === null) return fallback;
    return value as T;
  },
}));