import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupService, BackupFile } from '../services/backup';

export const useBackupList = () => {
    return useQuery({
        queryKey: ['backups'],
        queryFn: () => backupService.getBackups(),
    });
};

export const useCreateBackup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => backupService.createBackup(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backups'] });
        },
    });
};

export const useDeleteBackup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (filename: string) => backupService.deleteBackup(filename),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backups'] });
        },
    });
};

export const useRestoreBackup = () => {
    return useMutation({
        mutationFn: ({ filename, password }: { filename: string; password: string }) => 
            backupService.restoreBackup(filename, password),
    });
};
