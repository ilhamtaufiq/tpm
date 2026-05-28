import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { ProtectedFeatures } from '../store/useSecurityStore';

interface SecurityStatusResponse {
    is_pin_enabled: boolean;
    protected_features: ProtectedFeatures;
}

export const useSecurityStatus = () => {
    return useQuery({
        queryKey: ['security', 'status'],
        queryFn: async () => {
            const { data } = await api.get<SecurityStatusResponse>('/security/status');
            return data;
        },
    });
};

export const useSetupPin = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (pin: string) => {
            const { data } = await api.post('/security/pin/setup', { pin });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['security'] });
        },
    });
};

export const useVerifyPin = () => {
    return useMutation({
        mutationFn: async (pin: string) => {
            const { data } = await api.post<{ valid: boolean, message: string }>('/security/pin/verify', { pin });
            return data.valid;
        },
    });
};

export const useChangePin = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ old_pin, new_pin }: { old_pin: string, new_pin: string }) => {
            const { data } = await api.post('/security/pin/change', { old_pin, new_pin });
            return data;
        },
    });
};

export const useDisablePin = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (pin: string) => {
            const { data } = await api.post('/security/pin/disable', { pin });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['security'] });
        },
    });
};

export const useUpdateSecuritySettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (settings: Partial<ProtectedFeatures>) => {
            const { data } = await api.put<{ message: string, protected_features: ProtectedFeatures }>('/security/settings', settings);
            return data.protected_features;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['security'] });
        },
    });
};
