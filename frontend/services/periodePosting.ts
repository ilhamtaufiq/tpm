import api from '../utils/api';

export interface PeriodePosting {
    tahun: number;
    bulan: number;
    label: string;
    status: 'TERBUKA' | 'DIPOSTING';
    diposting_pada: string | null;
    diposting_oleh: number | null;
    catatan: string | null;
    dibuka_pada: string | null;
    dibuka_oleh: number | null;
    alasan_buka: string | null;
    sudah_berakhir: boolean;
}

export const periodePostingService = {
    list: async (tahun?: number): Promise<{ tahun: number; periode: PeriodePosting[] }> => {
        const response = await api.get('/periode-posting', { params: { tahun } });
        return response.data;
    },

    posting: async (tahun: number, bulan: number, catatan?: string): Promise<PeriodePosting> => {
        const response = await api.post(`/periode-posting/${tahun}/${bulan}/posting`, { catatan: catatan || null });
        return response.data;
    },

    bukaKembali: async (tahun: number, bulan: number, alasan: string): Promise<PeriodePosting> => {
        const response = await api.post(`/periode-posting/${tahun}/${bulan}/buka`, { alasan });
        return response.data;
    },
};
