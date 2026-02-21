import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keuanganService } from '../services/keuangan';

// =============================================
// KAS & BANK
// =============================================
export const useKasBankBalances = () => {
    return useQuery({
        queryKey: ['kas_bank_balances'],
        queryFn: () => keuanganService.getKasBankBalances(),
    });
};

export const useKasBankList = (params?: any) => {
    return useQuery({
        queryKey: ['kas_bank_list', params],
        queryFn: () => keuanganService.getKasBankList(params),
    });
};

export const useTransfer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => keuanganService.transfer(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
        },
    });
};

export const useCreateTransaction = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => keuanganService.createTransaction(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            queryClient.invalidateQueries({ queryKey: ['recent_activity'] });
        },
    });
};

// =============================================
// PIUTANG
// =============================================
export const usePiutangList = (params?: any) => {
    return useQuery({
        queryKey: ['piutang_list', params],
        queryFn: () => keuanganService.getPiutangList(params),
    });
};

export const usePiutangSummary = (params?: any) => {
    return useQuery({
        queryKey: ['piutang_summary', params],
        queryFn: () => keuanganService.getPiutangSummary(params),
    });
};

export const useProcessPayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => keuanganService.processPayment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['piutang_list'] });
            queryClient.invalidateQueries({ queryKey: ['piutang_summary'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
        },
    });
};

export const useProcessPaymentSplit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => keuanganService.processPaymentSplit(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['piutang_list'] });
            queryClient.invalidateQueries({ queryKey: ['piutang_summary'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
        },
    });
};

export const useCreatePiutang = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => keuanganService.createPiutang(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['piutang_list'] });
            queryClient.invalidateQueries({ queryKey: ['piutang_summary'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
        },
    });
};

// =============================================
// HUTANG
// =============================================
export const useHutangList = (params?: any) => {
    return useQuery({
        queryKey: ['hutang_list', params],
        queryFn: () => keuanganService.getHutangList(params),
    });
};

export const useHutangSummary = (params?: any) => {
    return useQuery({
        queryKey: ['hutang_summary', params],
        queryFn: () => keuanganService.getHutangSummary(params),
    });
};

export const useProcessHutangPayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => keuanganService.processHutangPayment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hutang_list'] });
            queryClient.invalidateQueries({ queryKey: ['hutang_summary'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
        },
    });
};

export const useProcessHutangPaymentSplit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => keuanganService.processHutangPaymentSplit(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hutang_list'] });
            queryClient.invalidateQueries({ queryKey: ['hutang_summary'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
        },
    });
};

export const useCreateHutang = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => keuanganService.createHutang(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hutang_list'] });
            queryClient.invalidateQueries({ queryKey: ['hutang_summary'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
        },
    });
};

// =============================================
// DASHBOARD & REPORTS
// =============================================
export const useDashboardSummary = (params?: any) => {
    return useQuery({
        queryKey: ['dashboard_summary', params],
        queryFn: () => keuanganService.getDashboardSummary(params),
    });
};

export const useRecentActivity = (limit: number = 10) => {
    return useQuery({
        queryKey: ['recent_activity', limit],
        queryFn: () => keuanganService.getRecentActivity(limit),
    });
};

export const useKasBankDailySummary = (tanggal: string) => {
    return useQuery({
        queryKey: ['kas_bank_daily', tanggal],
        queryFn: () => keuanganService.getKasBankDailySummary(tanggal),
    });
};

export const useKasBankMonthlySummary = (tahun: number, bulan: number) => {
    return useQuery({
        queryKey: ['kas_bank_monthly', tahun, bulan],
        queryFn: () => keuanganService.getKasBankMonthlySummary(tahun, bulan),
    });
};

export const useCapitalReport = (params?: any) => {
    return useQuery({
        queryKey: ['capital_report', params],
        queryFn: () => keuanganService.getCapitalReport(params),
    });
};
