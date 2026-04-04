import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
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
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
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
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
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
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
        },
    });
};

// =============================================
// SPARE PARTS
// =============================================
export const useSparePartsList = (params?: any) => {
    return useInfiniteQuery({
        queryKey: ['spare_parts', params],
        queryFn: ({ pageParam = 0 }) => 
            bengkelService.getSpareParts({ ...params, skip: pageParam }),
        getNextPageParam: (lastPage) => {
            const nextSkip = lastPage.page * lastPage.size;
            return nextSkip < lastPage.total ? nextSkip : undefined;
        },
        initialPageParam: 0,
    });
};

export const useLowStockParts = () => {
    return useQuery({
        queryKey: ['spare_parts_low_stock'],
        queryFn: () => bengkelService.getLowStockParts(),
    });
};

export const useSparePartStats = () => {
    return useQuery({
        queryKey: ['spare_parts_stats'],
        queryFn: () => bengkelService.getSparePartStats(),
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

export const useBulkDeleteSpareParts = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (ids: number[]) => bengkelService.bulkDeleteSpareParts(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['spare_parts'] });
            queryClient.invalidateQueries({ queryKey: ['spare_parts_low_stock'] });
        },
    });
};

export const useExportSpareParts = () => {
    return useMutation({
        mutationFn: (ids?: number[]) => bengkelService.exportSpareParts(ids),
    });
};

export const useUpdateSparePartStock = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, quantity, operation }: { id: number; quantity: number; operation: 'add' | 'subtract' }) => 
            bengkelService.updateSparePartStock(id, quantity, operation),
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

export const useUploadSparePartImage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, formData }: { id: number; formData: FormData }) =>
            bengkelService.uploadSparePartImage(id, formData),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['spare_parts'] });
            queryClient.invalidateQueries({ queryKey: ['spare_parts', variables.id] });
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

export const useImportSpareParts = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (formData: FormData) => bengkelService.importSpareParts(formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['spare_parts'] });
            queryClient.invalidateQueries({ queryKey: ['spare_parts_low_stock'] });
        },
    });
};

export const useNextSparePartKode = () => {
    return useQuery({
        queryKey: ['spare_parts_next_kode'],
        queryFn: () => bengkelService.getNextSparePartKode(),
        enabled: false,
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
        mutationFn: (data: any) => bengkelService.createPembelianParts(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pembelian_parts'] });
            queryClient.invalidateQueries({ queryKey: ['spare_parts'] });
            queryClient.invalidateQueries({ queryKey: ['hutang_list'] });
            queryClient.invalidateQueries({ queryKey: ['hutang_summary'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
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
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
        },
    });
};
