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
// ARMADA
// =============================================
export const useArmadaList = (params?: any) => {
    return useQuery({
        queryKey: ['armada', params],
        queryFn: () => jasaAngkutService.getArmadaList(params),
    });
};

export const useActiveArmada = (tanggal?: string) => {
    return useQuery({
        queryKey: ['armada_active', tanggal],
        queryFn: () => jasaAngkutService.getActiveArmada(tanggal),
    });
};

export const useCreateArmada = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: jasaAngkutService.createArmada,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['armada'] });
            queryClient.invalidateQueries({ queryKey: ['armada_active'] });
        },
    });
};

export const useUpdateArmada = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            jasaAngkutService.updateArmada(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['armada'] });
            queryClient.invalidateQueries({ queryKey: ['armada_active'] });
        },
    });
};

export const useDeleteArmada = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => jasaAngkutService.deleteArmada(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['armada'] });
            queryClient.invalidateQueries({ queryKey: ['armada_active'] });
        },
    });
};

export const useArmadaDetail = (id: number) => {
    return useQuery({
        queryKey: ['armada_detail', id],
        queryFn: () => jasaAngkutService.getArmadaDetail(id),
        enabled: !!id,
    });
};

// =============================================
// MUATAN
// =============================================
export const useMuatanList = (params?: any, options?: { refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['muatan', params],
        queryFn: () => jasaAngkutService.getMuatanList(params),
        ...options
    });
};

export const useMuatanSummary = (params?: any, options?: { refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['muatan_summary', params],
        queryFn: () => jasaAngkutService.getMuatanSummary(params),
        ...options
    });
};


export const useRouteSuggestions = (field: 'asal' | 'tujuan', query?: string) => {
    return useQuery({
        queryKey: ['muatan_suggestions', field, query],
        queryFn: () => jasaAngkutService.getRouteSuggestions(field, query),
        staleTime: 60 * 1000, // 1 minute
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
            queryClient.invalidateQueries({ queryKey: ['capital_report'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
        },
    });
};

export const useMarkMuatanPaid = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => jasaAngkutService.markPaid(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['muatan'] });
            queryClient.invalidateQueries({ queryKey: ['piutang'] });
            queryClient.invalidateQueries({ queryKey: ['capital_report'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
        },
    });
};

export const usePayMuatanSplit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: jasaAngkutService.payMuatanSplit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['muatan'] });
            queryClient.invalidateQueries({ queryKey: ['muatan_summary'] });
            queryClient.invalidateQueries({ queryKey: ['piutang'] });
            queryClient.invalidateQueries({ queryKey: ['armada_detail'] });
            queryClient.invalidateQueries({ queryKey: ['capital_report'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
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

export const useUpdateMuatanStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: number; status: 'PROSES' | 'SELESAI' | 'BATAL' }) =>
            jasaAngkutService.updateMuatanStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['muatan'] });
            queryClient.invalidateQueries({ queryKey: ['muatan_summary'] });
            queryClient.invalidateQueries({ queryKey: ['armada_active'] });
            queryClient.invalidateQueries({ queryKey: ['supir_active'] });
            queryClient.invalidateQueries({ queryKey: ['armada_detail'] });
        },
    });
};

export const useVoidMuatan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => jasaAngkutService.voidMuatan(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['muatan'] });
            queryClient.invalidateQueries({ queryKey: ['muatan_summary'] });
            queryClient.invalidateQueries({ queryKey: ['piutang'] });
            queryClient.invalidateQueries({ queryKey: ['capital_report'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_balances'] });
            queryClient.invalidateQueries({ queryKey: ['kas_bank_list'] });
            queryClient.invalidateQueries({ queryKey: ['armada_detail'] });
        },
    });
};

export const useDeleteMuatan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => jasaAngkutService.deleteMuatan(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['muatan'] });
            queryClient.invalidateQueries({ queryKey: ['muatan_summary'] });
        },
    });
};
