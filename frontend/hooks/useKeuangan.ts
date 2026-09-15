import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ActivityItem, KasBankListResponse, InvestorWithdrawalRequest, keuanganService } from '../services/keuangan';
import { bengkelService } from '../services/bengkel';
import {
    expenseUnitsParam,
    expenseToKasRow,
    filterWalletExpenseRows,
    mergeWalletRows,
} from '../utils/walletMerge';

// =============================================
// KAS & BANK
// =============================================
export const useKasBankBalances = (options?: { refetchInterval?: number; enabled?: boolean }) => {
    return useQuery({
        queryKey: ['kas_bank_balances'],
        queryFn: () => keuanganService.getKasBankBalances(),
        // Fresh enough for wallet UI; mutations + WS invalidate sooner when needed
        staleTime: 1000 * 30,
        refetchOnReconnect: true,
        ...options
    });
};

export const useKasBankList = (
    params?: any,
    options?: { enabled?: boolean; refetchInterval?: number }
) => {
    return useQuery<KasBankListResponse>({
        queryKey: ['kas_bank_list', params],
        queryFn: () => keuanganService.getKasBankList(params),
        ...options,
    });
};

// Pengeluaran ber-bisnis_kategori unit: baris kasnya selalu bersumber PENGELUARAN,
// jadi tak pernah cocok dengan filter dompet — diambil dari endpoint pengeluaran.
const useUnitWalletExpenses = (
    unitScope: string,
    params: { limit?: number; tanggal_dari?: string; tanggal_sampai?: string },
    options?: { enabled?: boolean },
) => {
    const bisnisKategori = expenseUnitsParam(unitScope);
    return useQuery({
        // Root 'pengeluaran' agar ikut ter-invalidate oleh realtime + sync offline.
        queryKey: ['pengeluaran', 'wallet', unitScope, params],
        queryFn: () => bengkelService.getPengeluaran({
            bisnis_kategori: bisnisKategori,
            limit: params.limit ?? 20,
            tanggal_dari: params.tanggal_dari,
            tanggal_sampai: params.tanggal_sampai,
            sort_by: 'tanggal',
            sort_order: 'desc',
        }),
        enabled: !!bisnisKategori && options?.enabled !== false,
    });
};

// Dompet unit = ledger KAS_UNIT_X + arus keluar unit dari akun pusat
// (kasbon/piutang sumber KAS_UTAMA/BANK_UTAMA tulis jenis pusat, sumber unit)
// + pengeluaran ber-bisnis_kategori unit.
export const useUnitWalletHistory = (
    jenis: string,
    sumber: string,
    baseParams?: any,
    options?: { enabled?: boolean; refetchInterval?: number }
) => {
    const params = baseParams ?? {};
    const ready = !!jenis && !!sumber && options?.enabled !== false;
    const walletQuery = useKasBankList({ ...params, jenis }, { ...options, enabled: ready });
    const centralQuery = useKasBankList(
        { ...params, sumber, tipe: 'KELUAR' },
        { ...options, enabled: ready }
    );
    const expenseQuery = useUnitWalletExpenses(sumber, {
        limit: params.limit ?? 20,
        tanggal_dari: params.tanggal_dari,
        tanggal_sampai: params.tanggal_sampai,
    }, { enabled: ready });
    const data = useMemo<KasBankListResponse | undefined>(() => {
        if (!ready) return undefined;
        const a = walletQuery.data?.data ?? [];
        const b = (centralQuery.data?.data ?? []).filter((item: any) => item.jenis !== jenis);
        const kept = filterWalletExpenseRows(
            expenseQuery.data?.data ?? [],
            sumber,
            [...a, ...b].map((item: any) => item.nomor_referensi).filter(Boolean),
        );
        const merged = mergeWalletRows(a, b, kept.map(expenseToKasRow));
        return { ...(walletQuery.data ?? centralQuery.data ?? {}), data: merged, total: merged.length } as KasBankListResponse;
    }, [ready, walletQuery.data, centralQuery.data, expenseQuery.data, jenis, sumber]);
    return {
        data,
        isLoading: ready && (walletQuery.isLoading || centralQuery.isLoading || expenseQuery.isLoading),
        refetch: async () => { await Promise.all([walletQuery.refetch(), centralQuery.refetch(), expenseQuery.refetch()]); },
    };
};

export const useTransfer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => keuanganService.transfer(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            queryClient.invalidateQueries({ queryKey: ['transaksi_bengkel_summary'] });
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
export const usePiutangList = (params?: any, options?: { enabled?: boolean; refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['piutang_list', params],
        queryFn: () => keuanganService.getPiutangList(params),
        ...options,
    });
};

export const usePiutangSummary = (params?: any, options?: { refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['piutang_summary', params],
        queryFn: () => keuanganService.getPiutangSummary(params),
        ...options
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
            // Invalidate mobil queries so car status updates (BOOKING → TERJUAL)
            queryClient.invalidateQueries({ queryKey: ['mobil_detail'] });
            queryClient.invalidateQueries({ queryKey: ['penjualan_mobil_list'] });
            queryClient.invalidateQueries({ queryKey: ['mobil_list'] });
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
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
        },
    });
};

// =============================================
// HUTANG
// =============================================
export const useHutangList = (params?: any, options?: { enabled?: boolean; refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['hutang_list', params],
        queryFn: () => keuanganService.getHutangList(params),
        ...options,
    });
};

export const useHutangSummary = (params?: any, options?: { refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['hutang_summary', params],
        queryFn: () => keuanganService.getHutangSummary(params),
        ...options
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
export const useDashboardSummary = (params?: any, options?: { refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['dashboard_summary', params],
        queryFn: () => keuanganService.getDashboardSummary(params),
        ...options
    });
};

export const useRecentActivity = (
    limit: number = 10,
    source?: string,
    options?: { refetchInterval?: number; enabled?: boolean }
) => {
    return useQuery<ActivityItem[]>({
        queryKey: ['recent_activity', limit, source],
        queryFn: () => keuanganService.getRecentActivity(limit, source),
        staleTime: 1000 * 30,
        refetchOnReconnect: true,
        ...options
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

export const useCapitalReport = (params?: any, options?: { refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['capital_report', params],
        queryFn: () => keuanganService.getModalReport(params),
        staleTime: 1000 * 30,
        refetchOnReconnect: true,
        ...options
    });
};

export const useLabaRugiReport = (params?: any, options?: { refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['laba_rugi_report', params],
        queryFn: () => keuanganService.getLabaRugiReport(params),
        staleTime: 1000 * 30,
        refetchOnReconnect: true,
        ...options
    });
};

export const useNeracaReport = (params?: any, options?: { refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['neraca_report', params],
        queryFn: () => keuanganService.getNeracaReport(params),
        staleTime: 1000 * 30,
        refetchOnReconnect: true,
        ...options
    });
};

export const useValidateReports = (params?: any, options?: { refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['validate_reports', params],
        queryFn: () => keuanganService.validateReports(params),
        staleTime: 1000 * 30,
        refetchOnReconnect: true,
        enabled: false, // Only run on-demand
        ...options
    });
};
// =============================================
// INVESTOR DISBURSEMENT
// =============================================
export const usePendingInvestorDisbursements = (namaInvestor?: string) => {
    return useQuery({
        queryKey: ['pending_investor_disbursements', namaInvestor],
        queryFn: () => keuanganService.getPendingInvestorDisbursements(namaInvestor),
    });
};

export const useInvestorDisbursementSummary = (params?: any, options?: { refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['investor_disbursement_summary', params],
        queryFn: () => keuanganService.getInvestorDisbursementSummary(params),
        ...options
    });
};

export const useProcessInvestorDisbursement = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ transaksiId, data }: { transaksiId: number; data: any }) => 
            keuanganService.processInvestorDisbursement(transaksiId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending_investor_disbursements'] });
            queryClient.invalidateQueries({ queryKey: ['investor_disbursement_summary'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            queryClient.invalidateQueries({ queryKey: ['capital_report'] });
        },
    });
};
export const useReverseInvestorDisbursement = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ transaksiId, data }: { transaksiId: number; data?: { alasan?: string } }) =>
            keuanganService.reverseInvestorDisbursement(transaksiId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending_investor_disbursements'] });
            queryClient.invalidateQueries({ queryKey: ['investor_disbursement_summary'] });
            queryClient.invalidateQueries({ queryKey: ['investor_disbursement_history'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            queryClient.invalidateQueries({ queryKey: ['capital_report'] });
        },
    });
};
export const useInvestorDisbursementHistory = (params?: any) => {
    return useQuery({
        queryKey: ['investor_disbursement_history', params],
        queryFn: () => keuanganService.getInvestorDisbursementHistory(params),
    });
};

// =============================================
// PENARIKAN DANA INVESTOR (MOBIL BELUM TERJUAL)
// =============================================
const invalidateInvestorWithdrawal = (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: ['unsold_investor_cars'] });
    queryClient.invalidateQueries({ queryKey: ['investor_withdrawal_history'] });
    queryClient.invalidateQueries({ queryKey: ['investor_disbursement_summary'] });
    queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
    queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
    queryClient.invalidateQueries({ queryKey: ['capital_report'] });
};

export const useUnsoldInvestorCars = (namaInvestor?: string) => {
    return useQuery({
        queryKey: ['unsold_investor_cars', namaInvestor],
        queryFn: () => keuanganService.getUnsoldInvestorCars(namaInvestor),
    });
};

export const useInvestorWithdrawalHistory = (params?: any) => {
    return useQuery({
        queryKey: ['investor_withdrawal_history', params],
        queryFn: () => keuanganService.getInvestorWithdrawalHistory(params),
    });
};

export const useCreateInvestorWithdrawal = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: InvestorWithdrawalRequest) => keuanganService.createInvestorWithdrawal(data),
        onSuccess: () => invalidateInvestorWithdrawal(queryClient),
    });
};

export const useReverseInvestorWithdrawal = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data?: { alasan?: string } }) =>
            keuanganService.reverseInvestorWithdrawal(id, data),
        onSuccess: () => invalidateInvestorWithdrawal(queryClient),
    });
};

// =============================================
// USER CASH (CATATAN KEUANGAN CASH)
// =============================================
export const useUserCashList = () => {
    return useQuery({
        queryKey: ['user_cash_list'],
        queryFn: () => keuanganService.getUserCashList(),
    });
};

export const useAdjustUserCash = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, data }: { userId: number; data: { nominal: number; keterangan?: string } }) =>
            keuanganService.adjustUserCash(userId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user_cash_list'] });
            queryClient.invalidateQueries({ queryKey: ['user_cash_history'] });
        },
    });
};

export const useSetUserCash = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, params }: { userId: number; params: { nominal: number; keterangan?: string } }) =>
            keuanganService.setUserCash(userId, params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user_cash_list'] });
            queryClient.invalidateQueries({ queryKey: ['user_cash_history'] });
        },
    });
};

export const useUserCashHistory = (userId?: number) => {
    return useQuery({
        queryKey: ['user_cash_history', userId],
        queryFn: () => keuanganService.getUserCashHistory(userId),
    });
};
