import { useQuery } from '@tanstack/react-query';
import { dashboardService, financeService, reportService, stockService } from '../api/services';

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const monthStartISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export function useSummary() {
  return useQuery({
    queryKey: ['dashboard_summary'],
    queryFn: () => dashboardService.summary({ tanggal_dari: monthStartISO(), tanggal_sampai: todayISO() }),
    refetchInterval: 30_000,
  });
}

export function useActivity(limit = 20) {
  return useQuery({
    queryKey: ['recent_activity', limit],
    queryFn: () => dashboardService.recentActivity(limit),
    refetchInterval: 15_000,
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const [overdue, cashUsers, lowStock, validate] = await Promise.all([
        financeService.piutangOverdue(20).catch(() => []),
        financeService.userCashBalances().catch(() => []),
        stockService.lowStock().catch(() => []),
        reportService.validate().catch(() => null),
      ]);
      return { overdue, cashUsers, lowStock, validate };
    },
    refetchInterval: 60_000,
  });
}
