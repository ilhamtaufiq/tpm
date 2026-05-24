import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mobilService, InventorySummary, PenjualanSummary } from '../services/mobil';

export const useMobilList = (params?: any, options?: { refetchInterval?: number; enabled?: boolean }) => {
    return useQuery({
        queryKey: ['mobils', params],
        queryFn: () => mobilService.getMobils(params),
        ...options
    });
};

export const useCreateMobil = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: mobilService.createMobil,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mobils'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            queryClient.invalidateQueries({ queryKey: ['recent_activity'] });
        },
    });
};

export const useAddBiaya = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => mobilService.addBiaya(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['mobils'] });
            queryClient.invalidateQueries({ queryKey: ['mobils', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            queryClient.invalidateQueries({ queryKey: ['recent_activity'] });
        },
    });
};

export const useDeleteBiaya = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, biayaId }: { id: number; biayaId: number }) => mobilService.deleteBiaya(id, biayaId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['mobils'] });
            queryClient.invalidateQueries({ queryKey: ['mobils', variables.id] });
        },
    });
};

export const useAddPartService = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => mobilService.addPartService(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['mobils'] });
            queryClient.invalidateQueries({ queryKey: ['mobils', variables.id] });
        },
    });
};

export const useDeletePartService = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, partServiceId }: { id: number; partServiceId: number }) => mobilService.deletePartService(id, partServiceId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['mobils'] });
            queryClient.invalidateQueries({ queryKey: ['mobils', variables.id] });
        },
    });
};

export const useCreatePenjualanMobil = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: mobilService.createPenjualan,
        onSuccess: () => {
            // Invalidate sales list and inventory
            queryClient.invalidateQueries({ queryKey: ['penjualan_mobil'] });
            queryClient.invalidateQueries({ queryKey: ['mobils'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            queryClient.invalidateQueries({ queryKey: ['recent_activity'] });
        },
    });
};

export const usePenjualanMobilList = (params?: any) => {
    return useQuery({
        queryKey: ['penjualan_mobil', params],
        queryFn: () => mobilService.getPenjualanMobils(params),
    });
};

export const usePayPenjualanMobil = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: { jumlah_bayar: number; metode_bayar?: string; payments?: { metode: string; nominal: number }[] } }) =>
            mobilService.payPenjualanMobil(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['penjualan_mobil'] });
            queryClient.invalidateQueries({ queryKey: ['mobils'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            queryClient.invalidateQueries({ queryKey: ['recent_activity'] });
        },
    });
};

export const useCancelBookingMobil = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: { penalti: number; metode_refund?: string; refund_payments?: { metode: string; nominal: number }[]; alasan?: string } }) =>
            mobilService.cancelBookingMobil(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['penjualan_mobil'] });
            queryClient.invalidateQueries({ queryKey: ['mobils'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            queryClient.invalidateQueries({ queryKey: ['recent_activity'] });
        },
    });
};

export const useMobilDetail = (id: number) => {
    return useQuery({
        queryKey: ['mobils', id],
        queryFn: () => mobilService.getMobil(id),
        enabled: !!id,
    });
};

export const useUploadMedia = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, files }: { id: number; files: any[] }) => mobilService.uploadMedia(id, files),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['mobils'] });
            queryClient.invalidateQueries({ queryKey: ['mobils', variables.id] });
        },
    });
};

export const useDeleteMedia = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, mediaId }: { id: number; mediaId: number }) => mobilService.deleteMedia(id, mediaId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['mobils'] });
            queryClient.invalidateQueries({ queryKey: ['mobils', variables.id] });
        },
    });
};
export const useUpdateMobil = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => mobilService.updateMobil(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['mobils'] });
            queryClient.invalidateQueries({ queryKey: ['mobils', variables.id] });
        },
    });
};

export const useDeleteMobil = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => mobilService.deleteMobil(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mobils'] });
        },
    });
};

export const useInventorySummary = (options?: any) => {
    return useQuery<InventorySummary>({
        queryKey: ['mobils_summary'],
        queryFn: () => mobilService.getInventorySummary(),
        ...options
    });
};

export const usePenjualanSummary = (params?: any, options?: { refetchInterval?: number }) => {
    return useQuery<PenjualanSummary>({
        queryKey: ['penjualan_mobil_summary', params],
        queryFn: () => mobilService.getPenjualanSummary(params),
        ...options
    });
};

