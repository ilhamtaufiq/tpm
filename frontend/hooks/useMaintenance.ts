import { useMutation, useQueryClient } from '@tanstack/react-query';
import { maintenanceService } from '../services/maintenance';

export const useResetTransactions = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: maintenanceService.resetTransactions,
        onSuccess: () => {
            // Invalidate all queries to refresh the app state
            queryClient.invalidateQueries();
        },
    });
};
