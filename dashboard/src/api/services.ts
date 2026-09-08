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
  kasBankDetail: (id: number) => get<Record<string, unknown>>(`/kas-bank/${id}`),
  kasBankByNomor: (nomor: string) => get<Record<string, unknown>>(`/kas-bank/by-nomor/${encodeURIComponent(nomor)}`),
  piutangSearch: (search: string) => get<{ data?: Record<string, unknown>[] }>('/piutang', { search, limit: 5 }),
  hutangSearch: (search: string) => get<{ data?: Record<string, unknown>[] }>('/hutang', { search, limit: 5 }),
  piutangPayments: (id: number) => get<Record<string, unknown>[]>(`/piutang/${id}/payments`),
  hutangPayments: (id: number) => get<Record<string, unknown>[]>(`/hutang/${id}/payments`),
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

// ── Pengaturan (Admin): import data + reset database ─────────────────────────
export interface ImportSheetResult {
  rows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ImportResult {
  batch_id: string;
  dry_run: boolean;
  ok: boolean;
  sheets: Record<string, ImportSheetResult>;
  neraca_verification?: {
    computed: Record<string, number>;
    expected: Record<string, number | null>;
    is_balanced: boolean;
    warnings: string[];
  };
  unknown_sheets?: string[];
}

const postMultipart = async <T>(url: string, file: File): Promise<T> => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await client.post(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  });
  return data as T;
};

export const dataImportService = {
  template: async () => {
    const { data } = await client.get('/data-import/template', { responseType: 'blob', timeout: 60000 });
    return data as Blob;
  },
  preview: (file: File) => postMultipart<ImportResult>('/data-import/preview', file),
  commit: (file: File) => postMultipart<ImportResult>('/data-import/commit', file),
};

export const systemService = {
  resetDatabase: () =>
    client.post<{
      status: string;
      message: string;
      truncated_tables: number;
      deleted_users: number;
      users: Array<{ id: number; username: string; role: string; email: string }>;
    }>('/system/reset-database').then((r) => r.data),
};

export interface BackupFile {
  filename: string;
  size: number;
  created_at: string;
}

export const backupService = {
  list: () => get<BackupFile[]>('/backup/list'),
  create: () => client.post<BackupFile>('/backup/create').then((r) => r.data),
  download: async (filename: string) => {
    const { data } = await client.get(`/backup/download/${encodeURIComponent(filename)}`, {
      responseType: 'blob',
      timeout: 120000,
    });
    const url = URL.createObjectURL(data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  remove: (filename: string) => client.delete(`/backup/${encodeURIComponent(filename)}`).then((r) => r.data),
  restore: (filename: string, password: string) =>
    client.post(`/backup/restore/${encodeURIComponent(filename)}`, { password }).then((r) => r.data),
  upload: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await client.post('/backup/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return data as BackupFile;
  },
};
