import { Platform } from 'react-native';
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
    home_background?: string;
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
    home_background?: string | null;
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

    uploadAvatar: async (uri: string) => {
        const formData = new FormData();
        const filename = uri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1] === 'jpg' ? 'jpeg' : match[1]}` : `image/jpeg`;

        if (Platform.OS === 'web') {
            const response = await fetch(uri);
            const blob = await response.blob();
            formData.append('file', blob, filename);
        } else {
            // @ts-ignore
            formData.append('file', {
                uri: uri,
                name: filename,
                type: type,
            });
        }

        const response = await api.post('/auth/me/avatar', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    uploadHomeBackground: async (uri: string) => {
        const formData = new FormData();
        const filename = uri.split('/').pop() || 'background.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1] === 'jpg' ? 'jpeg' : match[1]}` : `image/jpeg`;

        if (Platform.OS === 'web') {
            const response = await fetch(uri);
            const blob = await response.blob();
            formData.append('file', blob, filename);
        } else {
            // @ts-ignore
            formData.append('file', {
                uri: uri,
                name: filename,
                type: type,
            });
        }

        const response = await api.post('/auth/me/home-background', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
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
