import { Platform } from 'react-native';
import api from '../utils/api';

export interface Mobil {
    id: number;
    // ... other fields
}

export interface InventorySummary {
    total_units: number;
    total_value: number;
}

export interface PenjualanSummary {
    total_units_sold: number;
    total_revenue: number;
    total_profit: number;
}

export const mobilService = {
    getMobils: async (params?: any) => {
        const response = await api.get('/mobil', { params });
        return response.data;
    },
    getAvailableCars: async (params?: any) => {
        const response = await api.get('/mobil/available', { params });
        return response.data;
    },
    getInventorySummary: async (params?: any): Promise<InventorySummary> => {
        const response = await api.get('/mobil/summary', { params });
        return response.data;
    },
    getMobil: async (id: number) => {
        const response = await api.get(`/mobil/${id}`);
        return response.data;
    },
    createMobil: async (data: any) => {
        const response = await api.post('/mobil', data);
        return response.data;
    },
    updateMobil: async (id: number, data: any) => {
        const response = await api.put(`/mobil/${id}`, data);
        return response.data;
    },
    deleteMobil: async (id: number) => {
        const response = await api.delete(`/mobil/${id}`);
        return response.data;
    },
    addBiaya: async (id: number, data: any) => {
        const response = await api.post(`/mobil/${id}/biaya`, data);
        return response.data;
    },
    deleteBiaya: async (id: number, biayaId: number) => {
        const response = await api.delete(`/mobil/${id}/biaya/${biayaId}`);
        return response.data;
    },
    addPartService: async (id: number, data: any) => {
        const response = await api.post(`/mobil/${id}/part-service`, data);
        return response.data;
    },
    deletePartService: async (id: number, partServiceId: number) => {
        const response = await api.delete(`/mobil/${id}/part-service/${partServiceId}`);
        return response.data;
    },
    createPenjualan: async (data: any) => {
        const response = await api.post('/penjualan-mobil', data);
        return response.data;
    },
    getPenjualanMobils: async (params?: any) => {
        const response = await api.get('/penjualan-mobil', { params });
        return response.data;
    },
    getPenjualanSummary: async (params?: any): Promise<PenjualanSummary> => {
        const response = await api.get('/penjualan-mobil/summary', { params });
        return response.data;
    },
    getPenjualanMobil: async (id: number) => {
        const response = await api.get(`/penjualan-mobil/${id}`);
        return response.data;
    },
    payPenjualanMobil: async (id: number, data: { jumlah_bayar: number; metode_bayar?: string; payments?: { metode: string; nominal: number }[] }) => {
        const response = await api.patch(`/penjualan-mobil/${id}/payment`, data);
        return response.data;
    },
    cancelBookingMobil: async (id: number, data: { penalti: number; metode_refund?: string; refund_payments?: { metode: string; nominal: number }[]; alasan?: string }) => {
        const response = await api.post(`/penjualan-mobil/${id}/cancel`, data);
        return response.data;
    },

    uploadMedia: async (id: number, files: any[]) => {
        const formData = new FormData();

        // Handle both Web and Mobile
        for (const file of files) {
            if (Platform.OS === 'web') {
                // On web, we need to convert the URI to a Blob/File if it's not already one
                let blob = file.blob;
                if (!blob) {
                    const response = await fetch(file.uri);
                    blob = await response.blob();
                }
                formData.append('files', blob, file.name);
            } else {
                // On mobile, React Native's FormData polyfill handles the { uri, name, type } object
                formData.append('files', {
                    uri: file.uri,
                    name: file.name,
                    type: file.type,
                } as any);
            }
        }

        const response = await api.post(`/mobil/${id}/media`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },
    deleteMedia: async (id: number, mediaId: number) => {
        const response = await api.delete(`/mobil/${id}/media/${mediaId}`);
        return response.data;
    }
};
