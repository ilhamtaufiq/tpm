import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jasaAngkutService } from '../services/jasaAngkut';

// =============================================
// SUPIR
// =============================================
export const useSupirList = (params?: any) => {
    return useQuery({
        queryKey: ['supir', params],
        queryFn: () => jasaAngkutService.getSupirList(params),
    });
};

export const useActiveSupir = () => {
    return useQuery({
        queryKey: ['supir_active'],
        queryFn: () => jasaAngkutService.getActiveSupir(),
    });
};

export const useCreateSupir = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: jasaAngkutService.createSupir,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supir'] });
            queryClient.invalidateQueries({ queryKey: ['supir_active'] });
        },
    });
};

export const useUpdateSupir = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            jasaAngkutService.updateSupir(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supir'] });
        },
    });
};

export const useDeleteSupir = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => jasaAngkutService.deleteSupir(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supir'] });
        },
    });
};

// =============================================
// MUATAN
// =============================================
export const useMuatanList = (params?: any) => {
    return useQuery({
        queryKey: ['muatan', params],
        queryFn: () => jasaAngkutService.getMuatanList(params),
    });
};

export const useMuatanSummary = () => {
    return useQuery({
        queryKey: ['muatan_summary'],
        queryFn: () => jasaAngkutService.getMuatanSummary(),
    });
};

export const useMuatanBySupir = (supirId: number) => {
    return useQuery({
        queryKey: ['muatan_supir', supirId],
        queryFn: () => jasaAngkutService.getMuatanBySupir(supirId),
        enabled: !!supirId,
    });
};

export const useCreateMuatan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: jasaAngkutService.createMuatan,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['muatan'] });
            queryClient.invalidateQueries({ queryKey: ['muatan_summary'] });
        },
    });
};

export const useMarkMuatanPaid = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => jasaAngkutService.markMuatanPaid(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['muatan'] });
            queryClient.invalidateQueries({ queryKey: ['piutang'] });
        },
    });
};

export const useAddMuatanCost = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            jasaAngkutService.addMuatanCost(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['muatan'] });
        },
    });
};
