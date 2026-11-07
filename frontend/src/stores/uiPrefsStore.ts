import { create } from 'zustand';

export type TableDensity = 'comfortable' | 'compact';

const DENSITY_KEY = 'autoquote-table-density';

function readDensity(): TableDensity {
  try {
    const value = localStorage.getItem(DENSITY_KEY);
    if (value === 'comfortable' || value === 'compact') return value;
  } catch {
    // ignore
  }
  return 'comfortable';
}

interface UiPrefsState {
  tableDensity: TableDensity;
  setTableDensity: (density: TableDensity) => void;
  toggleTableDensity: () => void;
}

export const useUiPrefsStore = create<UiPrefsState>((set, get) => ({
  tableDensity: readDensity(),
  setTableDensity: (tableDensity) => {
    try {
      localStorage.setItem(DENSITY_KEY, tableDensity);
    } catch {
      // ignore
    }
    set({ tableDensity });
  },
  toggleTableDensity: () => {
    const next = get().tableDensity === 'compact' ? 'comfortable' : 'compact';
    get().setTableDensity(next);
  },
}));
