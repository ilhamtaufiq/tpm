import api from '../utils/api';

// --- Enums matching backend ---

export type PiutangStatus = 'BELUM_LUNAS' | 'LUNAS' | 'SEBAGIAN';
export type HutangStatus = 'BELUM_LUNAS' | 'LUNAS' | 'SEBAGIAN';
export type PiutangSource = 'BENGKEL' | 'JUAL_BELI_MOBIL' | 'JASA_ANGKUT' | 'KASBON_KARYAWAN' | 'LAINNYA';
export type HutangSource = 'PEMBELIAN_PART' | 'PEMBELIAN_MOBIL' | 'LAINNYA';
export type KasBankJenis = 'CASH' | 'BANK_BCA' | 'BANK_MANDIRI' | 'BANK_BRI' | 'BANK_LAINNYA' | 'BOP_JASA_ANGKUT_CASH' | 'BOP_JASA_ANGKUT_BCA' | 'BOP_MOBIL_CASH' | 'BOP_MOBIL_BCA';
export type KasBankType = 'MASUK' | 'KELUAR';
export type KasBankSource = 'BENGKEL' | 'JUAL_BELI_MOBIL' | 'JASA_ANGKUT' | 'PEMBELIAN_PART' | 'PEMBELIAN_MOBIL' | 'PENGELUARAN' | 'GAJI' | 'KASBON' | 'PIUTANG' | 'HUTANG' | 'MODAL' | 'PRIVE' | 'LAINNYA';
export type PaymentMethod = 'TUNAI' | 'TRANSFER' | 'KREDIT' | 'DEBIT' | 'SPLIT' | 'INTERNAL' | 'POTONG_GAJI' | 'OTHER';

// --- Investor Disbursement Interfaces ---

export interface InvestorDisbursementSummary {
    pending_count: number;
    pending_total: number;
    disbursed_count: number;
    disbursed_total: number;
}

export interface PendingDisbursement {
    id: number;
    tanggal_jual: string;
    nomor_transaksi: string;
    mobil: string;
    mobil_id: number;
    nama_investor: string;
    harga_beli: number;
    nominal_investor: number;
    harga_jual: number;
    total_modal: number;
    laba_kotor: number;
    persentase_investor: number;
    laba_investor: number;
    laba_tpm: number;
    total_pencairan: number;
    status_pencairan: string;
}

export interface DisbursementRequest {
    metode_bayar: PaymentMethod;
    tanggal?: string;
    catatan?: string;
}


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


// --- Hutang Interfaces ---

export interface Hutang {
    id: number;
    nomor_hutang: string;
    tanggal: string;
    sumber: HutangSource;
    referensi_id?: number;
    nomor_referensi?: string;
    supplier_id?: number;
    nama_kreditur: string;
    telepon_kreditur?: string;
    alamat_kreditur?: string;
    nominal_hutang: number;
    total_dibayar: number;
    sisa_hutang: number;
    persentase_terbayar: number;
    tanggal_jatuh_tempo?: string;
    tanggal_lunas?: string;
    status: HutangStatus;
    catatan?: string;
    pembayaran: PembayaranHutang[];
    created_at: string;
}

export interface PembayaranHutang {
    id: number;
    hutang_id: number;
    tanggal: string;
    nominal: number;
    metode_bayar: PaymentMethod;
    catatan?: string;
    created_at: string;
}

export interface HutangSummary {
    total_hutang: number;
    total_terbayar: number;
    total_sisa: number;
    jumlah_lunas: number;
    jumlah_belum_lunas: number;
    by_sumber: Record<string, { count: number; sisa_hutang: number }>;
}

export interface HutangListResponse {
    data: Hutang[];
    total: number;
    page: number;
    size: number;
    pages: number;
    total_hutang: number;
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
    bop_jasa_angkut_cash?: KasBankBalance;
    bop_jasa_angkut_bca?: KasBankBalance;
    bop_mobil_cash?: KasBankBalance;
    bop_mobil_bca?: KasBankBalance;
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

export interface UserCashAdjustment {
    id: number;
    user_id: number;
    admin_id: number;
    saldo_sebelum: number;
    saldo_sesudah: number;
    nominal: number;
    keterangan?: string;
    created_at: string;
}

export interface UserResponse {
    id: number;
    username: string;
    email: string;
    full_name: string;
    phone?: string;
    role: string;
    is_active: boolean;
    cash_balance: number;
    profile_picture?: string;
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

    processPaymentSplit: async (data: {
        piutang_id: number;
        tanggal: string;
        payments: {
            metode: PaymentMethod;
            nominal: number;
            catatan?: string;
        }[];
        catatan?: string;
    }): Promise<PembayaranPiutang[]> => {
        const response = await api.post('/piutang/payment/split', data);
        return response.data;
    },

    createPiutang: async (data: {
        tanggal: string;
        sumber: PiutangSource;
        nama_debitur: string;
        nominal_piutang: number;
        tanggal_jatuh_tempo?: string;
        metode_pembayaran?: PaymentMethod;
        payments?: {
            metode: PaymentMethod;
            nominal: number;
            catatan?: string;
        }[];
        catatan?: string;
    }): Promise<Piutang> => {
        const response = await api.post('/piutang', data);
        return response.data;
    },

    // ============================================
    // HUTANG METHODS
    // ============================================

    getHutangList: async (params?: {
        skip?: number;
        limit?: number;
        search?: string;
        supplier_id?: number;
        sumber?: HutangSource;
        status?: HutangStatus;
        tanggal_dari?: string;
        tanggal_sampai?: string;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<HutangListResponse> => {
        const response = await api.get('/hutang', { params });
        return response.data;
    },

    getHutangSummary: async (params?: {
        tanggal_dari?: string;
        tanggal_sampai?: string;
    }): Promise<HutangSummary> => {
        const response = await api.get('/hutang/summary', { params });
        return response.data;
    },

    getHutang: async (id: number): Promise<Hutang> => {
        const response = await api.get(`/hutang/${id}`);
        return response.data;
    },

    processHutangPayment: async (data: {
        hutang_id: number;
        tanggal: string;
        nominal: number;
        metode_bayar?: PaymentMethod;
        catatan?: string;
    }): Promise<PembayaranHutang> => {
        const response = await api.post('/hutang/pembayaran', data);
        return response.data;
    },

    processHutangPaymentSplit: async (data: {
        hutang_id: number;
        tanggal: string;
        payments: {
            metode: PaymentMethod;
            nominal: number;
            catatan?: string;
        }[];
        catatan?: string;
    }): Promise<PembayaranHutang[]> => {
        const response = await api.post('/hutang/pembayaran-split', data);
        return response.data;
    },

    createHutang: async (data: {
        tanggal: string;
        sumber: HutangSource;
        nama_kreditur: string;
        nominal_hutang: number;
        tanggal_jatuh_tempo?: string;
        metode_pembayaran?: PaymentMethod;
        payments?: {
            metode: PaymentMethod;
            nominal: number;
            catatan?: string;
        }[];
        catatan?: string;
    }): Promise<Hutang> => {
        const response = await api.post('/hutang', data);
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

    getNeracaReport: async (params?: {
        tanggal_dari?: string;
        tanggal_sampai?: string;
    }) => {
        const response = await api.get('/dashboard/neraca', { params });
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
    adjustBalance: async (data: {
        jenis: KasBankJenis;
        nominal: number;
        tanggal: string;
        keterangan: string;
    }) => {
        const response = await api.post('/kas-bank/adjust', null, { params: data });
        return response.data;
    },

    // ============================================
    // INVESTOR DISBURSEMENT METHODS
    // ============================================

    getPendingInvestorDisbursements: async (namaInvestor?: string): Promise<PendingDisbursement[]> => {
        const response = await api.get('/penjualan-mobil/investor/pending-disbursements', {
            params: { nama_investor: namaInvestor }
        });
        return response.data;
    },

    getInvestorDisbursementSummary: async (params?: {
        tanggal_dari?: string;
        tanggal_sampai?: string;
    }): Promise<InvestorDisbursementSummary> => {
        const response = await api.get('/penjualan-mobil/investor/disbursement-summary', { params });
        return response.data;
    },

    processInvestorDisbursement: async (transaksiId: number, data: DisbursementRequest) => {
        const response = await api.post(`/penjualan-mobil/${transaksiId}/disburse`, data);
        return response.data;
    },
    getInvestorDisbursementHistory: async (params?: {
        nama_investor?: string;
        tanggal_dari?: string;
        tanggal_sampai?: string;
    }): Promise<any[]> => {
        const response = await api.get('/penjualan-mobil/investor/disbursement-history', { params });
        return response.data;
    },

    // ============================================
    // USER CASH (CATATAN KEUANGAN CASH)
    // ============================================
    getUserCashList: async (): Promise<UserResponse[]> => {
        const response = await api.get('/user-cash/users');
        return response.data;
    },
    adjustUserCash: async (userId: number, data: { nominal: number; keterangan?: string }): Promise<UserResponse> => {
        const response = await api.post(`/user-cash/${userId}/adjust`, data);
        return response.data;
    },
    setUserCash: async (userId: number, params: { nominal: number; keterangan?: string }): Promise<UserResponse> => {
        const response = await api.post(`/user-cash/${userId}/set`, null, { params });
        return response.data;
    },
    getUserCashHistory: async (userId?: number): Promise<UserCashAdjustment[]> => {
        const response = await api.get('/user-cash/history', { params: { user_id: userId } });
        return response.data;
    },
};

