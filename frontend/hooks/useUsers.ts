import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService, UserCreateData, UserUpdateData } from '../services/auth';

export const useUserList = (params?: { skip?: number; limit?: number; is_active?: boolean }) => {
    return useQuery({
        queryKey: ['users', params],
        queryFn: () => authService.getUsers(params),
    });
};

export const useUser = (id: number) => {
    return useQuery({
        queryKey: ['user', id],
        queryFn: () => authService.getUser(id),
        enabled: !!id,
    });
};

export const useDeleteCheck = (id?: number | null) => {
    return useQuery({
        queryKey: ['user-delete-check', id],
        queryFn: () => authService.checkDeleteUser(id as number),
        enabled: !!id,
        staleTime: 0,
    });
};

export const useCreateUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: UserCreateData) => authService.createUser(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });
};

export const useUpdateUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UserUpdateData }) => 
            authService.updateUser(id, data),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['user', id] });
            queryClient.invalidateQueries({ queryKey: ['user-delete-check', id] });
        },
    });
};

export const useDeleteUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, permanent }: { id: number; permanent: boolean }) =>
            authService.deleteUser(id, permanent),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['user', id] });
            queryClient.invalidateQueries({ queryKey: ['user-delete-check', id] });
        },
    });
};
