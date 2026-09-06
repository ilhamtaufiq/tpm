import client from './client';

export interface PeriodParams {
  tanggal_dari?: string;
  tanggal_sampai?: string;
  [key: string]: unknown;
}

const get = async <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
  const { data } = await client.get(url, { params });
  return data as T;
};

export const authService = {
  login: async (username: string, password: string) => {
    const { data } = await client.post('/auth/login/json', { username, password });
    return data as {
      access_token?: string;
      otp_required?: boolean;
      user?: { id: number; username: string; role?: string; full_name?: string };
    };
  },
  me: async () => get<{ id: number; username: string; role: string; full_name?: string }>('/auth/me'),
};

export const dashboardService = {
  summary: (p?: PeriodParams) => get('/dashboard/summary', p),
  recentActivity: (limit = 20) => get<unknown[]>('/dashboard/recent-activity', { limit }),
};

export const reportService = {
  labaRugi: (p?: PeriodParams) => get('/laporan/laba-rugi', p),
  neraca: (as_of_date?: string) => get('/laporan/neraca', { as_of_date }),
  modal: (p?: PeriodParams) => get('/laporan/perubahan-modal', p),
  validate: (p?: PeriodParams) => get('/laporan/validate', p),
};

export const financeService = {
  piutangOverdue: (limit = 20) => get<unknown[]>('/piutang/overdue', { limit }),
  piutangSummary: (p?: PeriodParams) => get('/piutang/summary', p),
  hutangSummary: (p?: PeriodParams) => get('/hutang/summary', p),
  kasBankBalances: () => get('/kas-bank/balances'),
  kasBankList: (params?: Record<string, unknown>) => get('/kas-bank', params),
  userCashBalances: () => get<unknown[]>('/user-cash/users'),
  userCashHistory: (limit = 50) => get<unknown[]>('/user-cash/history', { limit }),
};

export const stockService = {
  lowStock: () => get<unknown[]>('/spare-parts/low-stock'),
  stats: () => get('/spare-parts/stats'),
  stockValue: () => get('/spare-parts/stock-value'),
  list: (params?: Record<string, unknown>) => get('/spare-parts', params),
  mobilList: (params?: Record<string, unknown>) => get('/mobil', params),
};

export interface PageResponse<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Drill-down: daftar transaksi sumber per angka laporan (read-only, limit 100).
export const drillService = {
  kasMasukModal: (p: PeriodParams) =>
    get<PageResponse<Record<string, unknown>>>('/kas-bank', {
      sumber: 'MODAL',
      tipe: 'MASUK',
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal',
      sort_order: 'asc',
    }),
  kasJenis: (jenis: string, p: PeriodParams) =>
    get<PageResponse<Record<string, unknown>>>('/kas-bank', {
      jenis,
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal',
      sort_order: 'asc',
    }),
  bengkel: (p: PeriodParams) =>
    get<PageResponse<Record<string, unknown>>>('/transaksi-bengkel', {
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal',
      sort_order: 'asc',
    }),
  pengeluaran: (p: PeriodParams) =>
    get<PageResponse<Record<string, unknown>>>('/pengeluaran', {
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal',
      sort_order: 'asc',
    }),
  penjualanMobil: (p: PeriodParams) =>
    get<PageResponse<Record<string, unknown>>>('/penjualan-mobil', {
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal',
      sort_order: 'asc',
    }),
  mobilMasuk: (p: PeriodParams) =>
    get<PageResponse<Record<string, unknown>>>('/mobil', {
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal_masuk',
      sort_order: 'asc',
    }),
  muatan: (p: PeriodParams) =>
    get<PageResponse<Record<string, unknown>>>('/muatan', {
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal',
      sort_order: 'asc',
    }),
  piutang: (p: PeriodParams) => drillService.piutangFiltered(p),
  piutangFiltered: (p: PeriodParams, sumber?: string) =>
    get<PageResponse<Record<string, unknown>>>('/piutang', {
      ...(sumber ? { sumber } : {}),
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal',
      sort_order: 'asc',
    }),
  hutang: (p: PeriodParams) => drillService.hutangFiltered(p),
  hutangFiltered: (p: PeriodParams, sumber?: string) =>
    get<PageResponse<Record<string, unknown>>>('/hutang', {
      ...(sumber ? { sumber } : {}),
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal',
      sort_order: 'asc',
    }),
  investorHistory: (p: PeriodParams) =>
    get<Record<string, unknown>[]>('/penjualan-mobil/investor/disbursement-history', {
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
    }),
  investorPending: () =>
    get<Record<string, unknown>[]>('/penjualan-mobil/investor/pending-disbursements'),
  pembelianPart: (p: PeriodParams) =>
    get<PageResponse<Record<string, unknown>>>('/pembelian-parts', {
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal',
      sort_order: 'asc',
    }),
  // Slip gaji LUNAS per tanggal bayar — amountKey 'gaji_pokok' | 'uang_lembur'.
  slipGajiRange: (p: PeriodParams) =>
    get<PageResponse<Record<string, unknown>>>('/slip-gaji', {
      status: 'LUNAS',
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal_bayar',
      sort_order: 'asc',
    }),
  slipGaji: (p: PeriodParams, _amountKey: string) => drillService.slipGajiRange(p),
  // Pengeluaran ledger per unit bisnis (filter bisnis_kategori backend).
  pengeluaranUnit: (unit: string, p: PeriodParams) =>
    get<PageResponse<Record<string, unknown>>>('/pengeluaran', {
      bisnis_kategori: unit,
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal',
      sort_order: 'asc',
    }),
  // Kas-bank per sumber + tipe (mis. PRIVE/KELUAR).
  kasSumber: (sumber: string, tipe: string, p: PeriodParams) =>
    get<PageResponse<Record<string, unknown>>>('/kas-bank', {
      sumber,
      tipe,
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal',
      sort_order: 'asc',
    }),
  // Kasbon karyawan (posisi outstanding s.d. tanggal_sampai).
  kasbon: (p: PeriodParams) =>
    get<PageResponse<Record<string, unknown>>>('/kasbon', {
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
      sort_by: 'tanggal',
      sort_order: 'asc',
    }),
  // Aset tetap aktif (snapshot).
  aset: () =>
    get<PageResponse<Record<string, unknown>>>('/assets', { status: 'AKTIF', limit: 100 }),
  // Revaluasi harga beli sparepart + release (drill Penyesuaian).
  revaluasi: (p: PeriodParams) =>
    get<{ data: Record<string, unknown>[]; total: number; total_amount: number; total_released: number }>('/pembelian-parts/revaluasi', {
      tanggal_dari: p.tanggal_dari,
      tanggal_sampai: p.tanggal_sampai,
      limit: 100,
    }),
};

export const domainService = {
  mobilSummary: (p?: PeriodParams) => get('/penjualan-mobil/summary', p),
  muatanSummary: (p?: PeriodParams) => get('/muatan/summary', p),
  kasbonOutstanding: () => get('/kasbon', { status: 'BELUM_LUNAS', limit: 50 }),
  kasbonSummary: () => get('/kasbon/summary'),
  absensiToday: (tanggal: string) => get(`/absensi/daily/${tanggal}`),
  slipGajiStatus: (params?: Record<string, unknown>) => get('/slip-gaji', params),
};
