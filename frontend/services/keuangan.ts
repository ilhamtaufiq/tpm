import api from '../utils/api';

// --- Enums matching backend ---

export type PiutangStatus = 'BELUM_LUNAS' | 'LUNAS' | 'SEBAGIAN';
export type PiutangSource = 'BENGKEL' | 'JUAL_BELI_MOBIL' | 'JASA_ANGKUT' | 'KASBON_KARYAWAN' | 'LAINNYA';
export type KasBankJenis = 'CASH' | 'BANK_BCA' | 'BANK_MANDIRI' | 'BANK_BRI' | 'BANK_LAINNYA';
export type KasBankType = 'MASUK' | 'KELUAR';
export type KasBankSource = 'BENGKEL' | 'JUAL_BELI_MOBIL' | 'JASA_ANGKUT' | 'PEMBELIAN_PART' | 'PEMBELIAN_MOBIL' | 'PENGELUARAN' | 'GAJI' | 'KASBON' | 'PIUTANG' | 'MODAL' | 'PRIVE' | 'LAINNYA';
export type PaymentMethod = 'TUNAI' | 'TRANSFER' | 'KREDIT' | 'DEBIT' | 'SPLIT';

// --- Piutang Interfaces ---

export interface Piutang {
    id: number;
    nomor_piutang: string;
    tanggal: string;
    sumber: PiutangSource;
    referensi_id?: number;
    nomor_referensi?: string;
    customer_id?: number;
    nama_debitur: string;
    telepon_debitur?: string;
    alamat_debitur?: string;
    nominal_piutang: number;
    total_dibayar: number;
    sisa_piutang: number;
    persentase_terbayar: number;
    tanggal_jatuh_tempo?: string;
    tanggal_lunas?: string;
    status: PiutangStatus;
    is_overdue: boolean;
    catatan?: string;
    pembayaran: PembayaranPiutang[];
    created_at: string;
}

export interface PembayaranPiutang {
    id: number;
    piutang_id: number;
    tanggal: string;
    nominal: number;
    metode_bayar: PaymentMethod;
    catatan?: string;
    created_at: string;
}

export interface PiutangSummary {
    total_piutang: number;
    total_terbayar: number;
    total_sisa: number;
    jumlah_lunas: number;
    jumlah_belum_lunas: number;
    jumlah_overdue: number;
    by_sumber: Record<string, { count: number; total: number }>;
}

export interface PiutangListResponse {
    data: Piutang[];
    total: number;
    page: number;
    size: number;
    pages: number;
    total_piutang: number;
    total_terbayar: number;
    total_sisa: number;
}

// --- Kas Bank Interfaces ---

export interface KasBankTransaction {
    id: number;
    nomor_transaksi: string;
    tanggal: string;
    jenis: KasBankJenis;
    tipe: KasBankType;
    nominal: number;
    sumber: KasBankSource;
    referensi_id?: number;
    nomor_referensi?: string;
    saldo_sebelum: number;
    saldo_sesudah: number;
    keterangan: string;
    catatan?: string;
    created_at: string;
}

export interface KasBankBalance {
    jenis: KasBankJenis;
    saldo: number;
    total_masuk_bulan_ini: number;
    total_keluar_bulan_ini: number;
}

export interface KasBankAllBalances {
    cash: KasBankBalance;
    bank_bca?: KasBankBalance;
    bank_mandiri?: KasBankBalance;
    bank_bri?: KasBankBalance;
    total_saldo: number;
}

export interface KasBankListResponse {
    data: KasBankTransaction[];
    total: number;
    page: number;
    size: number;
    pages: number;
    saldo_awal: number;
    total_masuk: number;
    total_keluar: number;
    saldo_akhir: number;
}

export interface ActivityItem {
    type: 'financial' | 'workshop';
    id: string;
    original_id: number;
    title: string;
    subtitle: string;
    amount: number;
    is_incoming: boolean;
    status: string;
    timestamp: string;
    source: string;
    ref_number?: string;
}

// --- Service ---

export const keuanganService = {
    // ============================================
    // PIUTANG METHODS
    // ============================================

    getPiutangList: async (params?: {
        skip?: number;
        limit?: number;
        search?: string;
        customer_id?: number;
        sumber?: PiutangSource;
        status?: PiutangStatus;
        overdue_only?: boolean;
        tanggal_dari?: string;
        tanggal_sampai?: string;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<PiutangListResponse> => {
        const response = await api.get('/piutang', { params });
        return response.data;
    },

    getPiutangSummary: async (params?: {
        tanggal_dari?: string;
        tanggal_sampai?: string;
    }): Promise<PiutangSummary> => {
        const response = await api.get('/piutang/summary', { params });
        return response.data;
    },

    getPiutangOverdue: async (limit: number = 20): Promise<Piutang[]> => {
        const response = await api.get('/piutang/overdue', { params: { limit } });
        return response.data;
    },

    getPiutang: async (id: number): Promise<Piutang> => {
        const response = await api.get(`/piutang/${id}`);
        return response.data;
    },

    getPiutangPayments: async (id: number): Promise<PembayaranPiutang[]> => {
        const response = await api.get(`/piutang/${id}/payments`);
        return response.data;
    },

    getPiutangByCustomer: async (customerId: number, unpaidOnly: boolean = true): Promise<Piutang[]> => {
        const response = await api.get(`/piutang/customer/${customerId}`, { params: { unpaid_only: unpaidOnly } });
        return response.data;
    },

    getCustomerPiutangTotal: async (customerId: number) => {
        const response = await api.get(`/piutang/customer/${customerId}/total`);
        return response.data;
    },

    processPayment: async (data: {
        piutang_id: number;
        tanggal: string;
        nominal: number;
        metode_bayar?: PaymentMethod;
        catatan?: string;
    }): Promise<PembayaranPiutang> => {
        const response = await api.post('/piutang/payment', data);
        return response.data;
    },

    createPiutang: async (data: {
        tanggal: string;
        sumber: PiutangSource;
        nama_debitur: string;
        nominal_piutang: number;
        tanggal_jatuh_tempo?: string;
        catatan?: string;
    }): Promise<Piutang> => {
        const response = await api.post('/piutang', data);
        return response.data;
    },

    // ============================================
    // KAS BANK METHODS
    // ============================================

    getKasBankList: async (params?: {
        skip?: number;
        limit?: number;
        jenis?: KasBankJenis;
        tipe?: KasBankType;
        sumber?: KasBankSource;
        tanggal_dari?: string;
        tanggal_sampai?: string;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<KasBankListResponse> => {
        const response = await api.get('/kas-bank', { params });
        return response.data;
    },

    getKasBankBalances: async (): Promise<KasBankAllBalances> => {
        const response = await api.get('/kas-bank/balances');
        return response.data;
    },

    getKasBankBalance: async (jenis: KasBankJenis): Promise<KasBankBalance> => {
        const response = await api.get(`/kas-bank/balance/${jenis}`);
        return response.data;
    },

    getKasBankDailySummary: async (tanggal: string) => {
        const response = await api.get(`/kas-bank/daily/${tanggal}`);
        return response.data;
    },

    getKasBankMonthlySummary: async (tahun: number, bulan: number) => {
        const response = await api.get(`/kas-bank/monthly/${tahun}/${bulan}`);
        return response.data;
    },

    getKasBankTransaction: async (id: number): Promise<KasBankTransaction> => {
        const response = await api.get(`/kas-bank/${id}`);
        return response.data;
    },

    transfer: async (data: {
        dari: KasBankJenis;
        ke: KasBankJenis;
        nominal: number;
        tanggal: string;
        keterangan: string;
    }) => {
        const response = await api.post('/kas-bank/transfer', null, { params: data });
        return response.data;
    },

    getDashboardSummary: async (params?: {
        tanggal_dari?: string;
        tanggal_sampai?: string;
    }) => {
        const response = await api.get('/dashboard/summary', { params });
        return response.data;
    },

    getRecentActivity: async (limit: number = 10): Promise<ActivityItem[]> => {
        const response = await api.get('/dashboard/recent-activity', { params: { limit } });
        return response.data;
    },

    getProfitSummary: async (params?: {
        tanggal_dari?: string;
        tanggal_sampai?: string;
    }) => {
        const response = await api.get('/dashboard/profit-summary', { params });
        return response.data;
    },

    getCapitalReport: async (params?: {
        tanggal_dari?: string;
        tanggal_sampai?: string;
    }) => {
        const response = await api.get('/dashboard/capital-report', { params });
        return response.data;
    },

    createTransaction: async (data: {
        tanggal: string;
        jenis: KasBankJenis;
        tipe: KasBankType;
        nominal: number;
        sumber: KasBankSource;
        keterangan: string;
        catatan?: string;
    }): Promise<KasBankTransaction> => {
        const response = await api.post('/kas-bank', data);
        return response.data;
    },
};
