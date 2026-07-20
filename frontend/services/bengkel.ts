import api from '../utils/api';

// --- Interfaces ---

export interface SparePart {
    id: number;
    kode: string;
    nama: string;
    kode_part?: string;
    kode_ean?: string;
    kategori?: string;
    satuan?: string;
    harga_beli: number;
    harga_jual: number;
    stok: number;
    stok_minimum: number;
    rak_lokasi?: string;
    catatan?: string;
    gambar?: string;
    created_at: string;
}

export interface TransaksiBengkel {
    id: number;
    nomor_transaksi: string;
    public_receipt_token?: string;
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
    status_bayar: 'LUNAS' | 'BELUM_LUNAS' | 'CICILAN' | 'INTERNAL' | 'BATAL';
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
    status_bayar: 'LUNAS' | 'BELUM_LUNAS' | 'CICILAN' | 'INTERNAL' | 'BATAL';
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

    getSparePartById: async (id: number): Promise<SparePart> => {
        const response = await api.get(`/spare-parts/${id}`);
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

    getSparePartStats: async () => {
        const response = await api.get('/spare-parts/stats');
        return response.data;
    },

    createSparePart: async (data: any) => {
        const response = await api.post('/spare-parts', data);
        return response.data;
    },

    updateSparePart: async (id: number, data: any) => {
        const response = await api.put(`/spare-parts/${id}`, data);
        return response.data;
    },
    
    updateSparePartStock: async (id: number, quantity: number, operation: 'add' | 'subtract') => {
        const response = await api.patch(`/spare-parts/${id}/stock`, null, { 
            params: { quantity, operation } 
        });
        return response.data;
    },

    deleteSparePart: async (id: number) => {
        const response = await api.delete(`/spare-parts/${id}`);
        return response.data;
    },

    importSpareParts: async (formData: FormData) => {
        // Must set multipart header — same as avatar/media/backup uploads.
        // Without it, Android RN axios often fails with "Network Error".
        const response = await api.post('/spare-parts/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            timeout: 120000, // large Excel can take a while
        });
        return response.data;
    },

    getNextSparePartKode: async () => {
        const response = await api.get('/spare-parts/next-kode');
        return response.data;
    },

    uploadSparePartImage: async (id: number, formData: FormData) => {
        const response = await api.post(`/spare-parts/${id}/image`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    bulkDeleteSpareParts: async (ids: number[]) => {
        const response = await api.post('/spare-parts/bulk-delete', ids);
        return response.data;
    },

    exportSpareParts: async (ids?: number[]) => {
        const response = await api.get('/spare-parts/export', {
            params: { ids },
            paramsSerializer: (params) => {
                const searchParams = new URLSearchParams();
                if (params.ids) {
                    params.ids.forEach((id: number) => searchParams.append('ids', id.toString()));
                }
                return searchParams.toString();
            },
            responseType: 'blob'
        });
        return response.data;
    },

    downloadSparePartImportTemplate: async (format: 'stok_format' | 'standard') => {
        const response = await api.get('/spare-parts/import-template', {
            params: { format },
            responseType: 'blob',
        });
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

    updatePembelianParts: async (id: number, data: any) => {
        const response = await api.put(`/pembelian-parts/${id}`, data);
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
