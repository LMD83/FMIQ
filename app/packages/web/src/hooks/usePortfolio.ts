import { useQuery } from '@tanstack/react-query';
import {
  api, type Zone, type WorkOrder, type Summary, type Site,
  type Obligation, type Project, type ReadingSeries,
} from '../api';

/** Shared read hooks for the portfolio endpoints (routes/portfolio.ts et al.). */

export const useZones = () =>
  useQuery({ queryKey: ['zones'], queryFn: () => api<{ zones: Zone[] }>('/api/v1/zones') });

export const useWorkOrders = () =>
  useQuery({ queryKey: ['work-orders'], queryFn: () => api<{ workOrders: WorkOrder[] }>('/api/v1/work-orders') });

export const useSummary = () =>
  useQuery({ queryKey: ['summary'], queryFn: () => api<Summary>('/api/v1/summary') });

export const useSites = () =>
  useQuery({ queryKey: ['sites'], queryFn: () => api<{ sites: Site[] }>('/api/v1/sites') });

export const useObligations = () =>
  useQuery({ queryKey: ['obligations'], queryFn: () => api<{ obligations: Obligation[] }>('/api/v1/compliance') });

export const useProjects = () =>
  useQuery({ queryKey: ['projects'], queryFn: () => api<{ projects: Project[] }>('/api/v1/projects') });

export const useReadingTrend = (zoneId: string, metric = 'rh', hours = 24) =>
  useQuery({
    queryKey: ['readings', zoneId, metric, hours],
    queryFn: () => api<ReadingSeries>(`/api/v1/zones/${zoneId}/readings?metric=${metric}&hours=${hours}`),
  });
