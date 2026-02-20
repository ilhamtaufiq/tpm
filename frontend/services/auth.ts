import api from '../utils/api';

export interface UserUpdateData {
    username?: string;
    email?: string;
    full_name?: string;
    phone?: string;
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
    }
};
