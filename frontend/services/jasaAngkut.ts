import api from '../utils/api';

// --- Interfaces ---

export interface Supir {
    id: number;
    kode: string;
    nama: string;
    nik?: string;
    alamat?: string;
    telepon?: string;
    nomor_sim?: string;
    jenis_sim?: string;
    tanggal_bergabung: string;
    is_active: boolean;
    catatan?: string;
    created_at: string;
    updated_at: string;
}

export interface SupirSummary {
    supir: Supir;
    total_muatan: number;
    total_pendapatan: number;
    total_laba_tpm: number;
    total_piutang: number;
}

export interface Muatan {
    id: number;
    nomor_transaksi: string;
    tanggal: string;
    supir_id: number;
    supir?: Supir;
    supir_nama?: string;
    supir_nama_manual?: string;
    asal: string;
    tujuan: string;
    jenis_muatan?: string;
    berat_muatan?: string;
    pendapatan_kotor: number;
    biaya_bbm: number;
    biaya_tol: number;
    biaya_makan: number;
    biaya_parkir: number;
    biaya_lainnya: number;
    total_biaya: number;
    laba_kotor: number;
    persentase_tpm: number;
    laba_tpm: number;
    laba_supir: number;
    status_bayar: 'Lunas' | 'Belum Lunas';
    tanggal_bayar?: string;
    biaya_tambahan?: BiayaLainnya[];
    catatan?: string;
    created_at: string;
}

export interface MuatanCreate {
    tanggal: string; // YYYY-MM-DD
    supir_id: number;
    asal: string;
    tujuan: string;
    jenis_muatan?: string;
    berat_muatan?: string;
    pendapatan_kotor: number;
    biaya_bbm?: number;
    biaya_tol?: number;
    biaya_makan?: number;
    biaya_parkir?: number;
    biaya_lainnya?: number;
    persentase_tpm?: number; // Default 50
    catatan?: string;
}

export interface BiayaLainnya {
    id: number;
    muatan_id: number;
    kategori: string;
    deskripsi: string;
    jumlah: number;
    catatan?: string;
}

// --- Service ---

export const jasaAngkutService = {
    // Supir Methods
    getSupirList: async (params?: {
        skip?: number;
        limit?: number;
        search?: string;
        is_active?: boolean;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }) => {
        const response = await api.get('/supir', { params });
        return response.data;
    },

    getActiveSupir: async () => {
        const response = await api.get('/supir/active');
        return response.data;
    },

    getSupir: async (id: number) => {
        const response = await api.get(`/supir/${id}`);
        return response.data;
    },

    createSupir: async (data: any) => {
        const response = await api.post('/supir', data);
        return response.data;
    },

    updateSupir: async (id: number, data: any) => {
        const response = await api.put(`/supir/${id}`, data);
        return response.data;
    },

    setSupirActive: async (id: number, isActive: boolean) => {
        const response = await api.patch(`/supir/${id}/active?is_active=${isActive}`);
        return response.data;
    },

    getSupirSummary: async (id: number) => {
        const response = await api.get(`/supir/${id}/summary`);
        return response.data;
    },

    // Muatan Methods
    getMuatanList: async (params?: {
        skip?: number;
        limit?: number;
        search?: string;
        supir_id?: number;
        status_bayar?: string;
        tanggal_dari?: string;
        tanggal_sampai?: string;
    }) => {
        const response = await api.get('/muatan', { params });
        return response.data;
    },

    getMuatan: async (id: number) => {
        const response = await api.get(`/muatan/${id}`);
        return response.data;
    },

    createMuatan: async (data: MuatanCreate) => {
        const response = await api.post('/muatan', data);
        return response.data;
    },

    updateMuatan: async (id: number, data: any) => {
        const response = await api.put(`/muatan/${id}`, data);
        return response.data;
    },

    deleteMuatan: async (id: number) => {
        const response = await api.delete(`/muatan/${id}`);
        return response.data;
    },

    getMuatanSummary: async (params?: { tanggal_dari?: string; tanggal_sampai?: string }) => {
        const response = await api.get('/muatan/summary', { params });
        return response.data;
    },

    getDriverRecentTrips: async (supirId: number, limit: number = 5) => {
        const response = await api.get(`/muatan/supir/${supirId}/recent`, { params: { limit } });
        return response.data;
    },

    markPaid: async (id: number, metode_bayar: string = 'tunai') => {
        const response = await api.patch(`/muatan/${id}/paid`, null, {
            params: { metode_bayar }
        });
        return response.data;
    },
};
