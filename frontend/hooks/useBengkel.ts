import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bengkelService } from '../services/bengkel';

// =============================================
// TRANSAKSI BENGKEL
// =============================================
export const useTransaksiBengkelList = (params?: any, options?: any) => {
    return useQuery<any>({
        queryKey: ['transaksi_bengkel', params],
        queryFn: () => bengkelService.getTransaksi(params),
        ...options,
    });
};

export const useTransaksiBengkelSummary = (params?: any, options?: any) => {
    return useQuery<any>({
        queryKey: ['transaksi_bengkel_summary', params],
        queryFn: () => bengkelService.getTransaksiSummary(params),
        ...options
    });
};

export const useCreateTransaksiBengkel = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: bengkelService.createTransaksi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transaksi_bengkel'] });
            queryClient.invalidateQueries({ queryKey: ['transaksi_bengkel_summary'] });
            queryClient.invalidateQueries({ queryKey: ['piutang_list'] });
            queryClient.invalidateQueries({ queryKey: ['piutang_summary'] });
        },
    });
};

export const useUpdateTransaksiBengkel = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            bengkelService.updateTransaksi(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transaksi_bengkel'] });
            queryClient.invalidateQueries({ queryKey: ['transaksi_bengkel_summary'] });
            queryClient.invalidateQueries({ queryKey: ['piutang_list'] });
            queryClient.invalidateQueries({ queryKey: ['piutang_summary'] });
        },
    });
};

export const useUpdateTransaksiBengkelPayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            bengkelService.updateTransaksiPayment(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transaksi_bengkel'] });
            queryClient.invalidateQueries({ queryKey: ['piutang'] });
        },
    });
};

export const useUpdateTransaksiBengkelStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) =>
            bengkelService.updateTransaksiStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transaksi_bengkel'] });
            queryClient.invalidateQueries({ queryKey: ['transaksi_bengkel_summary'] });
        },
    });
};

export const useVoidTransaksiBengkel = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => bengkelService.voidTransaksi(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transaksi_bengkel'] });
            queryClient.invalidateQueries({ queryKey: ['transaksi_bengkel_summary'] });
            queryClient.invalidateQueries({ queryKey: ['piutang_list'] });
            queryClient.invalidateQueries({ queryKey: ['piutang_summary'] });
        },
    });
};

// =============================================
// SPARE PARTS
// =============================================
export const useSparePartsList = (params?: any) => {
    return useQuery({
        queryKey: ['spare_parts', params],
        queryFn: () => bengkelService.getSpareParts(params),
    });
};

export const useLowStockParts = () => {
    return useQuery({
        queryKey: ['spare_parts_low_stock'],
        queryFn: () => bengkelService.getLowStockParts(),
    });
};

export const useCreateSparePart = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: bengkelService.createSparePart,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['spare_parts'] });
        },
    });
};

export const useUpdateSparePartStock = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            bengkelService.updateSparePartStock(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['spare_parts'] });
            queryClient.invalidateQueries({ queryKey: ['spare_parts_low_stock'] });
        },
    });
};

export const useUpdateSparePart = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            bengkelService.updateSparePart(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['spare_parts'] });
            queryClient.invalidateQueries({ queryKey: ['spare_parts_low_stock'] });
        },
    });
};

export const useDeleteSparePart = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => bengkelService.deleteSparePart(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['spare_parts'] });
            queryClient.invalidateQueries({ queryKey: ['spare_parts_low_stock'] });
        },
    });
};

// =============================================
// PEMBELIAN PARTS
// =============================================
export const usePembelianPartsList = (params?: any) => {
    return useQuery({
        queryKey: ['pembelian_parts', params],
        queryFn: () => bengkelService.getPembelianParts(params),
    });
};

export const useCreatePembelianParts = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: bengkelService.createPembelianParts,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pembelian_parts'] });
            queryClient.invalidateQueries({ queryKey: ['spare_parts'] });
            queryClient.invalidateQueries({ queryKey: ['hutang_list'] });
            queryClient.invalidateQueries({ queryKey: ['hutang_summary'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
        },
    });
};

// =============================================
// PENGELUARAN
// =============================================
export const usePengeluaranList = (params?: any) => {
    return useQuery({
        queryKey: ['pengeluaran', params],
        queryFn: () => bengkelService.getPengeluaran(params),
    });
};

export const usePengeluaranSummary = () => {
    return useQuery({
        queryKey: ['pengeluaran_summary'],
        queryFn: () => bengkelService.getPengeluaranSummary(),
    });
};

export const useCreatePengeluaran = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: bengkelService.createPengeluaran,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pengeluaran'] });
            queryClient.invalidateQueries({ queryKey: ['pengeluaran_summary'] });
        },
    });
};
