import { useMemo } from 'react';
import type { DashboardData, DashboardRange } from './dashboard-types';
import { sampleDashboard } from './sample-dashboard';

// The single swap point: when channels and analytics ship, this becomes a TanStack query
// against the API and the cards stay unchanged.
export function useDashboard(range: DashboardRange): DashboardData {
  return useMemo(() => sampleDashboard(range), [range]);
}
