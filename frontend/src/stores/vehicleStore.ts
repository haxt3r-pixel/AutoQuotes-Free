import { create } from 'zustand';
import { api } from '../api/client';

export interface Vehicle {
  id: number;
  customer_id: number | null;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  submodel: string | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string | null;
  mileage: number | null;
  license_plate: string | null;
  color: string | null;
  created_at: string;
}

interface VehicleState {
  vehicles: Vehicle[];
  isLoading: boolean;
  error: string | null;

  loadVehicles: (customerId?: number) => Promise<void>;
  createVehicle: (data: Partial<Vehicle>) => Promise<Vehicle | null>;
  updateVehicle: (id: number, data: Partial<Vehicle>) => Promise<Vehicle | null>;
  deleteVehicle: (id: number) => Promise<void>;
}

export const useVehicleStore = create<VehicleState>((set, get) => ({
  vehicles: [],
  isLoading: false,
  error: null,

  loadVehicles: async (customerId?: number) => {
    if (!customerId) {
      set({ vehicles: [], isLoading: false, error: null });
      return;
    }
    set({ isLoading: true });
    try {
      const res = await api.get<Vehicle[]>(`/vehicles?customer_id=${customerId}`);
      if (res.success) {
        set({ vehicles: res.data, isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createVehicle: async (data) => {
    try {
      const res = await api.post<Vehicle>('/vehicles', data);
      if (res.success) {
        set({ vehicles: [res.data, ...get().vehicles] });
        return res.data;
      }
    } catch (err: any) {
      set({ error: err.message });
    }
    return null;
  },

  updateVehicle: async (id, data) => {
    try {
      const res = await api.put<Vehicle>(`/vehicles/${id}`, data);
      if (res.success) {
        set({
          vehicles: get().vehicles.map(v => (v.id === id ? res.data : v)),
        });
        return res.data;
      }
    } catch (err: any) {
      set({ error: err.message });
    }
    return null;
  },

  deleteVehicle: async (id) => {
    try {
      await api.delete(`/vehicles/${id}`);
      set({ vehicles: get().vehicles.filter(v => v.id !== id) });
    } catch (err: any) {
      set({ error: err.message });
    }
  },
}));
