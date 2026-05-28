import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jasaServisService, JasaServis } from '../services/jasaServis';

export const useJasaList = (params?: any) => {
    return useQuery({
        queryKey: ['jasa-servis', params],
        queryFn: () => jasaServisService.getJasaList(params),
    });
};

export const useCreateJasa = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<JasaServis>) => jasaServisService.createJasa(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jasa-servis'] });
        },
    });
};

export const useUpdateJasa = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<JasaServis> }) =>
            jasaServisService.updateJasa(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jasa-servis'] });
        },
    });
};

export const useDeleteJasa = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => jasaServisService.deleteJasa(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jasa-servis'] });
        },
    });
};
