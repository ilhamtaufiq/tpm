import api from '../utils/api';

// --- Interfaces ---

export interface SparePart {
    id: number;
    kode: string;
    nama: string;
    kategori?: string;
    satuan?: string;
    harga_beli: number;
    harga_jual: number;
    stok: number;
    stok_minimum: number;
    rak_lokasi?: string;
    catatan?: string;
    created_at: string;
}

export interface TransaksiBengkel {
    id: number;
    nomor_transaksi: string;
    tanggal: string;
    customer_id?: number;
    customer_nama?: string;
    mekanik_id?: number;
    mekanik_nama?: string;
    plat_nomor: string;
    tipe_motor?: string;
    kilometer?: number;
    kategori: 'umum' | 'jasa_angkut' | 'jual_beli_mobil';
    muatan_id?: number;
    muatan_nomor?: string;
    mobil_id?: number;
    total_jasa: number;
    total_part: number;
    total_biaya: number;
    total_bayar: number;
    kembalian: number;
    status_pengerjaan: 'ANTRE' | 'PROSES' | 'SELESAI' | 'BATAL';
    status_bayar: 'LUNAS' | 'BELUM_LUNAS' | 'CICILAN';
    piutang_id?: number;
    jumlah_bayar?: number;
    catatan?: string;
    created_at: string;
}

export interface PembelianPart {
    id: number;
    nomor_transaksi: string;
    tanggal: string;
    supplier_id: number;
    supplier_nama?: string;
    total_biaya: number;
    status_bayar: 'LUNAS' | 'BELUM_LUNAS' | 'CICILAN';
    piutang_id?: number;
    catatan?: string;
    created_at: string;
}

export interface PengeluaranBengkel {
    id: number;
    tanggal: string;
    kategori: string;
    jumlah: number;
    deskripsi?: string;
    catatan?: string;
    created_at: string;
}

// --- Service ---

export const bengkelService = {
    // Transaksi Methods
    getTransaksi: async (params?: any) => {
        const response = await api.get('/transaksi-bengkel', { params });
        return response.data;
    },

    getDetailTransaksi: async (id: number) => {
        const response = await api.get(`/transaksi-bengkel/${id}`);
        return response.data;
    },

    getTransaksiSummary: async (params?: any) => {
        const response = await api.get('/transaksi-bengkel/summary', { params });
        return response.data;
    },

    createTransaksi: async (data: any) => {
        const response = await api.post('/transaksi-bengkel', data);
        return response.data;
    },
    
    updateTransaksi: async (id: number, data: any) => {
        const response = await api.put(`/transaksi-bengkel/${id}`, data);
        return response.data;
    },

    updateTransaksiPayment: async (id: number, data: any) => {
        const response = await api.patch(`/transaksi-bengkel/${id}/payment`, data);
        return response.data;
    },

    updateTransaksiStatus: async (id: number, status: string) => {
        const response = await api.patch(`/transaksi-bengkel/${id}/status?status=${status}`);
        return response.data;
    },

    voidTransaksi: async (id: number) => {
        const response = await api.delete(`/transaksi-bengkel/${id}`);
        return response.data;
    },

    // Spare Part Methods
    getSpareParts: async (params?: any) => {
        const response = await api.get('/spare-parts', { params });
        return response.data;
    },

    searchSpareParts: async (query: string) => {
        const response = await api.get('/spare-parts/search', { params: { q: query } });
        return response.data;
    },

    getLowStockParts: async () => {
        const response = await api.get('/spare-parts/low-stock');
        return response.data;
    },

    getStockValue: async () => {
        const response = await api.get('/spare-parts/stock-value');
        return response.data;
    },

    createSparePart: async (data: any) => {
        const response = await api.post('/spare-parts', data);
        return response.data;
    },

    updateSparePartStock: async (id: number, data: any) => {
        const response = await api.patch(`/spare-parts/${id}/stock`, data);
        return response.data;
    },

    updateSparePart: async (id: number, data: any) => {
        const response = await api.put(`/spare-parts/${id}`, data);
        return response.data;
    },

    deleteSparePart: async (id: number) => {
        const response = await api.delete(`/spare-parts/${id}`);
        return response.data;
    },

    // Pembelian Methods
    getPembelianParts: async (params?: any) => {
        const response = await api.get('/pembelian-parts', { params });
        return response.data;
    },

    getPembelianSummary: async (params?: any) => {
        const response = await api.get('/pembelian-parts/summary', { params });
        return response.data;
    },

    getDetailPembelianPart: async (id: number) => {
        const response = await api.get(`/pembelian-parts/${id}`);
        return response.data;
    },

    createPembelianParts: async (data: any) => {
        const response = await api.post('/pembelian-parts', data);
        return response.data;
    },

    // Pengeluaran Methods
    getPengeluaran: async (params?: any) => {
        const response = await api.get('/pengeluaran', { params });
        return response.data;
    },

    getPengeluaranSummary: async () => {
        const response = await api.get('/pengeluaran/summary');
        return response.data;
    },

    createPengeluaran: async (data: any) => {
        const response = await api.post('/pengeluaran', data);
        return response.data;
    },
};
