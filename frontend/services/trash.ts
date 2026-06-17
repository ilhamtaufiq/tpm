import api from '../utils/api';

export const trashService = {
    getTrash: async (category: string) => {
        const response = await api.get(`/trash/${category}`);
        return response.data;
    },
    restoreItem: async (category: string, id: number) => {
        const response = await api.post(`/trash/${category}/${id}/restore`);
        return response.data;
    },
    permanentDelete: async (category: string, id: number) => {
        const response = await api.delete(`/trash/${category}/${id}/permanent`);
        return response.data;
    },
    emptyTrash: async (category: string) => {
        const response = await api.delete(`/trash/${category}/permanent`);
        return response.data;
    }
};
