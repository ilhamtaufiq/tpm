import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trashService } from '../services/trash';

export const useTrashList = (category: string) => {
    return useQuery({
        queryKey: ['trash', category],
        queryFn: () => trashService.getTrash(category),
        enabled: !!category,
    });
};

export const useRestoreItem = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ category, id }: { category: string; id: number }) => 
            trashService.restoreItem(category, id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['trash', variables.category] });
            // Invalidate relevant business unit queries
            queryClient.invalidateQueries({ queryKey: ['spare_parts'] });
            queryClient.invalidateQueries({ queryKey: [variables.category] });
        },
    });
};

export const usePermanentDelete = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ category, id }: { category: string; id: number }) => 
            trashService.permanentDelete(category, id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['trash', variables.category] });
        },
    });
};
