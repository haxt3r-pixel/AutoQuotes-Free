import type { ApiResponse } from '../types';

const BASE_URL = '/api';

class ApiClient {
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const url = `${BASE_URL}${path}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const json = await response.json();

    if (!response.ok && !json.success) {
      console.error(`[API] ${method} ${path} failed:`, json);
    }

    return json as ApiResponse<T>;
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body?: unknown) { return this.request<T>('POST', path, body); }
  put<T>(path: string, body?: unknown) { return this.request<T>('PUT', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }

  // Catalog endpoints
  async getMakes(): Promise<string[]> {
    const res = await this.get<string[]>('/vehicles/catalog/makes');
    return res.success ? res.data : [];
  }

  async getModels(make: string, year?: number): Promise<{ model: string; yearRange: [number, number] | null; trimCount: number }[]> {
    const suffix = year ? `?year=${year}` : '';
    const res = await this.get<{ model: string; yearRange: [number, number] | null; trimCount: number }[]>(`/vehicles/catalog/models/${encodeURIComponent(make)}${suffix}`);
    return res.success ? res.data : [];
  }

  async getTrims(make: string, model: string, year?: number): Promise<string[]> {
    const suffix = year ? `?year=${year}` : '';
    const res = await this.get<string[]>(`/vehicles/catalog/trims/${encodeURIComponent(make)}/${encodeURIComponent(model)}${suffix}`);
    return res.success ? res.data : [];
  }

  async getEngines(make: string, model: string, trim: string, year?: number): Promise<string[]> {
    const suffix = year ? `?year=${year}` : '';
    const res = await this.get<string[]>(`/vehicles/catalog/engines/${encodeURIComponent(make)}/${encodeURIComponent(model)}/${encodeURIComponent(trim)}${suffix}`);
    return res.success ? res.data : [];
  }

  async getDrivetrains(make: string, model: string, trim: string, year?: number, engine?: string): Promise<string[]> {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (engine) params.set('engine', engine);
    const suffix = params.size ? `?${params.toString()}` : '';
    const res = await this.get<string[]>(`/vehicles/catalog/drivetrains/${encodeURIComponent(make)}/${encodeURIComponent(model)}/${encodeURIComponent(trim)}${suffix}`);
    return res.success ? res.data : [];
  }
}

export const api = new ApiClient();