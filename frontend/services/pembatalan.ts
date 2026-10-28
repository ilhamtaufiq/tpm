import api from '../utils/api';

export interface PembatalanKeuangan {
    id: number;
    jenis: 'PENGELUARAN' | 'PIUTANG' | 'TRANSFER' | string;
    nomor_dokumen: string;
    dokumen_id: number | null;
    ringkasan: string;
    nominal: number | string;
    alasan: string;
    kas_nomor: string | null;
    dibatalkan_at: string;
    dibatalkan_by: number | null;
}

export const pembatalanService = {
    batalkanKas: async (kasId: number, alasan: string): Promise<PembatalanKeuangan> => {
        const response = await api.post(`/pembatalan/kas/${kasId}`, null, { params: { alasan } });
        return response.data;
    },

    batalkanPengeluaran: async (pengeluaranId: number, alasan: string): Promise<PembatalanKeuangan> => {
        const response = await api.post(`/pembatalan/pengeluaran/${pengeluaranId}`, null, { params: { alasan } });
        return response.data;
    },

    listRiwayat: async (jenis?: string, limit: number = 100): Promise<PembatalanKeuangan[]> => {
        const response = await api.get('/pembatalan', { params: { jenis, limit } });
        return response.data;
    },
};
