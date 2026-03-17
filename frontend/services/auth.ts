import api from '../utils/api';

export interface User {
    id: number;
    username: string;
    email: string;
    full_name: string;
    phone?: string;
    role: string;
    is_active: boolean;
    last_login?: string;
    profile_picture?: string;
    created_at: string;
    updated_at: string;
}

export interface UserCreateData {
    username: string;
    email: string;
    full_name: string;
    phone?: string;
    role: string;
    password: string;
}

export interface UserUpdateData {
    username?: string;
    email?: string;
    full_name?: string;
    phone?: string;
    role?: string;
    is_active?: boolean;
    password?: string;
    profile_picture?: string | null;
}

export const authService = {
    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },

    updateMe: async (data: UserUpdateData) => {
        const response = await api.put('/auth/me', data);
        return response.data;
    },

    changePassword: async (oldPassword: string, newPassword: string) => {
        const response = await api.post('/auth/change-password', null, {
            params: {
                old_password: oldPassword,
                new_password: newPassword
            }
        });
        return response.data;
    },

    // User Management (Admin Only)
    getUsers: async (params?: { skip?: number; limit?: number; is_active?: boolean }) => {
        const response = await api.get('/auth/users', { params });
        return response.data;
    },

    getUser: async (id: number) => {
        const response = await api.get(`/auth/users/${id}`);
        return response.data;
    },

    createUser: async (data: UserCreateData) => {
        const response = await api.post('/auth/register', data);
        return response.data;
    },

    updateUser: async (id: number, data: UserUpdateData) => {
        const response = await api.put(`/auth/users/${id}`, data);
        return response.data;
    },

    deleteUser: async (id: number) => {
        const response = await api.delete(`/auth/users/${id}`);
        return response.data;
    }
};
