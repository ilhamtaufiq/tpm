import api from '../utils/api';
import { PaymentMethod } from './keuangan';

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
    armada_default_id?: number;
    armada_default?: Armada;
    nopol_kendaraan?: string;
    info_kendaraan?: string;
    tanggal_bergabung: string;
    is_active: boolean;
    is_ready?: boolean;
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

export interface Armada {
    id: number;
    nama: string;
    nopol: string;
    jenis?: string;
    is_active: boolean;
    is_ready?: boolean;
    catatan?: string;
    created_at: string;
    updated_at: string;
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
    armada_id?: number;
    armada?: Armada;
    nopol?: string;
    info_kendaraan?: string;
    ritase?: number;
    harga_beli?: number;
    harga_jual?: number;
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
    status: 'PROSES' | 'SELESAI';
    status_bayar: 'LUNAS' | 'BELUM_LUNAS';
    metode_bayar?: PaymentMethod;
    tanggal_bayar?: string;
    biaya_tambahan?: BiayaLainnya[];
    part_services?: PartService[];
    piutang_id?: number;
    jumlah_bayar?: number;
    catatan?: string;
    created_at: string;
}

export interface MuatanSummary {
    total_transaksi?: number;
    lunas_count?: number;
    partial_count?: number;
    unpaid_count?: number;
    batal_count?: number;
    total_pendapatan?: number;
    laba_tpm?: number;
    saldo_bop?: number;
    total_tunai?: number;
    total_transfer?: number;
    total_dana_dari_utama?: number;
    details?: {
        gross_share_tpm: number;
        biaya_lainnya: number;
        biaya_bengkel: number;
    };
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
    status?: 'PROSES' | 'SELESAI';
    status_bayar?: 'LUNAS' | 'BELUM_LUNAS';
    metode_bayar?: PaymentMethod;
    biaya_operasional?: any[];
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

export interface PartService {
    id: number;
    tanggal: string;
    tipe: 'part' | 'service';
    deskripsi: string;
    qty: number;
    harga_satuan: number;
    total: number;
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

    deleteSupir: async (id: number) => {
        const response = await api.delete(`/supir/${id}`);
        return response.data;
    },

    // Armada Methods
    getArmadaList: async (params?: {
        skip?: number;
        limit?: number;
        search?: string;
        is_active?: boolean;
    }) => {
        const response = await api.get('/armada', { params });
        return response.data;
    },

    getActiveArmada: async (tanggal?: string) => {
        const response = await api.get('/armada/active', { params: { tanggal } });
        return response.data;
    },

    getArmada: async (id: number) => {
        const response = await api.get(`/armada/${id}`);
        return response.data;
    },

    createArmada: async (data: any) => {
        const response = await api.post('/armada', data);
        return response.data;
    },

    updateArmada: async (id: number, data: any) => {
        const response = await api.put(`/armada/${id}`, data);
        return response.data;
    },

    deleteArmada: async (id: number) => {
        const response = await api.delete(`/armada/${id}`);
        return response.data;
    },

    getArmadaDetail: async (id: number) => {
        const response = await api.get(`/armada/${id}/detail`);
        return response.data;
    },

    addArmadaExpense: async (id: number, data: {
        tanggal: string;
        deskripsi: string;
        jumlah: number;
        kategori?: string;
        catatan?: string;
        metode_bayar?: string;
        payments?: { metode: string; nominal: number; catatan?: string }[];
    }) => {
        const response = await api.post(`/armada/${id}/expense`, data);
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

    updateMuatanStatus: async (id: number, status: 'PROSES' | 'SELESAI') => {
        const response = await api.patch(`/muatan/${id}/status`, null, { params: { status } });
        return response.data;
    },

    deleteMuatan: async (id: number) => {
        const response = await api.delete(`/muatan/${id}`);
        return response.data;
    },

    getMuatanSummary: async (params?: { tanggal_dari?: string; tanggal_sampai?: string; search?: string }): Promise<MuatanSummary> => {
        const response = await api.get('/muatan/summary', { params });
        return response.data;
    },

    getRouteSuggestions: async (field: 'asal' | 'tujuan', query?: string, limit: number = 10): Promise<string[]> => {
        const response = await api.get(`/muatan/suggestions/${field}`, { params: { q: query, limit } });
        return response.data;
    },


    getDriverRecentTrips: async (supirId: number, limit: number = 5) => {
        const response = await api.get(`/muatan/supir/${supirId}/recent`, { params: { limit } });
        return response.data;
    },

    getMuatanBySupir: async (supirId: number) => {
        const response = await api.get(`/muatan/supir/${supirId}`);
        return response.data;
    },

    markPaid: async (id: number, metode_bayar: string = 'tunai') => {
        const response = await api.patch(`/muatan/${id}/paid`, null, {
            params: { metode_bayar: metode_bayar.toUpperCase() }
        });
        return response.data;
    },

    payMuatanSplit: async (data: { muatan_id: number; tanggal: string; payments: { metode: string; nominal: number; catatan?: string }[]; catatan?: string }) => {
        const response = await api.post(`/muatan/${data.muatan_id}/paid-split`, data);
        return response.data;
    },

    addMuatanCost: async (muatanId: number, data: any) => {
        const response = await api.post(`/muatan/${muatanId}/costs`, data);
        return response.data;
    },
};
