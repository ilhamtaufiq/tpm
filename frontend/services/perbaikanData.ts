import api from '../utils/api';

export interface PiutangTanpaKas {
    id: number;
    nomor_piutang: string;
    tanggal: string;
    nama_debitur: string;
    nominal_piutang: number;
    catatan: string | null;
}

export interface TanggalMundur {
    nomor_referensi: string;
    tanggal_lama: string;
    tanggal_seharusnya: string;
    jumlah_baris: number;
    total: number;
    keterangan: string | null;
    induk: 'PIUTANG' | 'HUTANG' | 'TRANSAKSI_BENGKEL' | null;
}

export const perbaikanDataService = {
    getPiutangTanpaKas: async (): Promise<PiutangTanpaKas[]> => {
        const response = await api.get('/perbaikan-data/piutang-tanpa-kas');
        return response.data;
    },

    catatKasPiutang: async (id: number, metode: 'TUNAI' | 'TRANSFER') => {
        const response = await api.post(`/perbaikan-data/piutang/${id}/catat-kas`, { metode });
        return response.data;
    },

    batalkanPiutang: async (id: number) => {
        const response = await api.post(`/perbaikan-data/piutang/${id}/batalkan`);
        return response.data;
    },

    getTanggalMundur: async (selisihHari = 1): Promise<TanggalMundur[]> => {
        const response = await api.get('/perbaikan-data/tanggal-mundur', { params: { selisih_hari: selisihHari } });
        return response.data;
    },

    ubahTanggal: async (payload: { nomor_referensi: string; tanggal_lama: string; tanggal_baru: string }) => {
        const response = await api.post('/perbaikan-data/tanggal', payload);
        return response.data;
    },
};
