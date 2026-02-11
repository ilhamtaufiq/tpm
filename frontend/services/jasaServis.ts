import api from '../utils/api';

export interface JasaServis {
    id: number;
    nama: string;
    kategori?: string;
    harga: number;
    deskripsi?: string;
    created_at: string;
    updated_at: string;
}

export interface JasaServisListResponse {
    data: JasaServis[];
    total: number;
    page: number;
    size: number;
    pages: number;
}

export const jasaServisService = {
    getJasaList: async (params?: {
        skip?: number;
        limit?: number;
        search?: string;
        kategori?: string;
    }): Promise<JasaServisListResponse> => {
        const response = await api.get('/jasa-servis', { params });
        return response.data;
    },

    getJasaById: async (id: number): Promise<JasaServis> => {
        const response = await api.get(`/jasa-servis/${id}`);
        return response.data;
    },

    createJasa: async (data: Partial<JasaServis>): Promise<JasaServis> => {
        const response = await api.post('/jasa-servis', data);
        return response.data;
    },

    updateJasa: async (id: number, data: Partial<JasaServis>): Promise<JasaServis> => {
        const response = await api.put(`/jasa-servis/${id}`, data);
        return response.data;
    },

    deleteJasa: async (id: number): Promise<void> => {
        await api.delete(`/jasa-servis/${id}`);
    },
};
