import api from '../utils/api';

// --- Enums ---
export type EmployeeStatus = 'AKTIF' | 'CUTI' | 'RESIGN' | 'TIDAK_AKTIF';
export type AttendanceStatus = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA' | 'LIBUR' | 'CUTI';
export type PaymentStatus = 'BELUM_LUNAS' | 'LUNAS';

// --- Karyawan Interfaces ---
export interface Karyawan {
    id: number;
    kode: string;
    nama: string;
    nik?: string;
    alamat?: string;
    telepon?: string;
    email?: string;
    jabatan: string;
    tanggal_lahir?: string;
    tanggal_bergabung: string;
    gaji_pokok: number;
    tunjangan: number;
    status: EmployeeStatus;
    catatan?: string;
    created_at: string;
    updated_at: string;
}

export interface KaryawanSummary {
    karyawan: Karyawan;
    total_hadir: number;
    total_kasbon: number;
    total_gaji_dibayar: number;
}

export interface EmployeeStats {
    total_karyawan: number;
    total_aktif: number;
    total_cuti: number;
    total_resign: number;
}

// --- Absensi Interfaces ---
export interface Absensi {
    id: number;
    karyawan_id: number;
    karyawan_nama?: string;
    tanggal: string;
    jam_masuk?: string;
    jam_keluar?: string;
    status: AttendanceStatus;
    keterangan?: string;
    created_at: string;
}

export interface DailyAttendance {
    tanggal: string;
    records: Array<{
        karyawan_id: number;
        karyawan_nama: string;
        absensi: Absensi | null;
    }>;
    summary: {
        hadir: number;
        izin: number;
        sakit: number;
        alpha: number;
    };
}

export interface MonthlyAttendanceSummary {
    karyawan_id: number;
    karyawan_nama: string;
    periode: string;
    hadir: number;
    izin: number;
    sakit: number;
    alpha: number;
    total_hari_kerja: number;
}

// --- Kasbon Interfaces ---
export interface Kasbon {
    id: number;
    karyawan_id: number;
    karyawan_nama?: string;
    tanggal: string;
    nominal: number;
    keterangan?: string;
    status: PaymentStatus;
    tanggal_lunas?: string;
    created_at: string;
}

export interface KasbonSummary {
    total_kasbon: number;
    total_lunas: number;
    total_belum_lunas: number;
    count_total: number;
    count_lunas: number;
    count_belum_lunas: number;
}

// --- Slip Gaji Interfaces (Weekly Payroll) ---
export interface SlipGaji {
    id: number;
    nomor_slip: string;
    karyawan_id: number;
    karyawan_nama?: string;
    periode_minggu: number;
    periode_tahun: number;
    tanggal_mulai: string;
    tanggal_akhir: string;
    jumlah_hadir: number;
    gaji_pokok: number;
    potongan_kasbon: number;
    gaji_bersih: number;
    status: PaymentStatus;
    tanggal_bayar?: string;
    metode_bayar?: string;
    catatan?: string;
    created_at: string;
}

export interface SlipGajiWeeklySummary {
    periode_minggu: number;
    periode_tahun: number;
    tanggal_mulai: string;
    tanggal_akhir: string;
    total_karyawan: number;
    total_gaji_pokok: number;
    total_potongan_kasbon: number;
    total_gaji_bersih: number;
    total_dibayar: number;
    total_belum_dibayar: number;
}

export interface SlipGajiPreviewItem {
    karyawan_id: number;
    karyawan_nama: string;
    karyawan_kode: string;
    gaji_pokok: number;
    jumlah_hadir: number;
    potongan_kasbon: number;
    gaji_bersih: number;
}

export interface SlipGajiPreview {
    periode_minggu: number;
    periode_tahun: number;
    tanggal_mulai: string;
    tanggal_akhir: string;
    items: SlipGajiPreviewItem[];
}

// --- Service ---
export const sdmService = {
    // =============================================
    // KARYAWAN METHODS
    // =============================================
    getKaryawanList: async (params?: {
        skip?: number;
        limit?: number;
        search?: string;
        status?: EmployeeStatus;
        jabatan?: string;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }) => {
        const response = await api.get('/karyawan', { params });
        return response.data;
    },

    getActiveKaryawan: async () => {
        const response = await api.get('/karyawan/active');
        return response.data;
    },

    getKaryawan: async (id: number): Promise<Karyawan> => {
        const response = await api.get(`/karyawan/${id}`);
        return response.data;
    },

    getKaryawanSummary: async (id: number): Promise<KaryawanSummary> => {
        const response = await api.get(`/karyawan/${id}/summary`);
        return response.data;
    },

    getEmployeeStats: async (): Promise<EmployeeStats> => {
        const response = await api.get('/karyawan/stats');
        return response.data;
    },

    getPositions: async (): Promise<string[]> => {
        const response = await api.get('/karyawan/positions');
        return response.data;
    },

    createKaryawan: async (data: Partial<Karyawan>): Promise<Karyawan> => {
        const response = await api.post('/karyawan', data);
        return response.data;
    },

    updateKaryawan: async (id: number, data: Partial<Karyawan>): Promise<Karyawan> => {
        const response = await api.put(`/karyawan/${id}`, data);
        return response.data;
    },

    setKaryawanStatus: async (id: number, status: EmployeeStatus): Promise<Karyawan> => {
        const response = await api.patch(`/karyawan/${id}/status?status=${status}`);
        return response.data;
    },

    deleteKaryawan: async (id: number) => {
        const response = await api.delete(`/karyawan/${id}`);
        return response.data;
    },

    // =============================================
    // ABSENSI METHODS
    // =============================================
    getAbsensiList: async (params?: {
        skip?: number;
        limit?: number;
        karyawan_id?: number;
        status?: AttendanceStatus;
        tanggal_dari?: string;
        tanggal_sampai?: string;
    }) => {
        const response = await api.get('/absensi', { params });
        return response.data;
    },

    getDailyAttendance: async (tanggal: string): Promise<DailyAttendance> => {
        const response = await api.get(`/absensi/daily/${tanggal}`);
        return response.data;
    },

    getMonthlyAttendance: async (karyawanId: number, tahun: number, bulan: number): Promise<MonthlyAttendanceSummary> => {
        const response = await api.get(`/absensi/monthly/${karyawanId}/${tahun}/${bulan}`);
        return response.data;
    },

    getAllMonthlyAttendance: async (tahun: number, bulan: number): Promise<MonthlyAttendanceSummary[]> => {
        const response = await api.get(`/absensi/monthly-all/${tahun}/${bulan}`);
        return response.data;
    },

    createAbsensi: async (data: Partial<Absensi>): Promise<Absensi> => {
        const response = await api.post('/absensi', data);
        return response.data;
    },

    clockIn: async (karyawanId: number, tanggal?: string, jam?: string): Promise<Absensi> => {
        const params: any = { karyawan_id: karyawanId };
        if (tanggal) params.tanggal = tanggal;
        if (jam) params.jam = jam;
        const response = await api.post('/absensi/clock-in', null, { params });
        return response.data;
    },

    bulkClockIn: async (karyawanId: number, dates: string[]): Promise<any> => {
        // 1. Get current month records to compare
        // We take the first date as a reference to determine the month
        if (dates.length === 0) return [];

        const refDate = new Date(dates[0]);
        const year = refDate.getFullYear();
        const month = refDate.getMonth() + 1;
        const lastDay = new Date(year, month, 0).getDate();

        const existing = await sdmService.getAbsensiList({
            karyawan_id: karyawanId,
            tanggal_dari: `${year}-${String(month).padStart(2, '0')}-01`,
            tanggal_sampai: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
            limit: 100
        });

        const existingMap = new Map();
        if (existing && Array.isArray(existing.data)) {
            existing.data.forEach((abs: any) => {
                existingMap.set(abs.tanggal.split('T')[0], abs.id);
            });
        }

        const datesToCreate = dates.filter(d => !existingMap.has(d));
        const idsToDelete = [];
        const selectedDatesSet = new Set(dates);

        for (const [date, id] of existingMap.entries()) {
            if (!selectedDatesSet.has(date)) {
                idsToDelete.push(id);
            }
        }

        const results = [];

        // Delete removals
        for (const id of idsToDelete) {
            try {
                await sdmService.deleteAbsensi(id);
            } catch (err) {
                console.error(`Failed to delete attendance ${id}:`, err);
            }
        }

        // Create additions
        for (const date of datesToCreate) {
            try {
                const res = await sdmService.clockIn(karyawanId, date);
                results.push(res);
            } catch (error) {
                console.error(`Failed to clock in for ${date}:`, error);
            }
        }

        return results;
    },

    clockOut: async (karyawanId: number, tanggal?: string, jam?: string): Promise<Absensi> => {
        const params: any = { karyawan_id: karyawanId };
        if (tanggal) params.tanggal = tanggal;
        if (jam) params.jam = jam;
        const response = await api.post('/absensi/clock-out', null, { params });
        return response.data;
    },

    updateAbsensi: async (id: number, data: Partial<Absensi>): Promise<Absensi> => {
        const response = await api.put(`/absensi/${id}`, data);
        return response.data;
    },

    deleteAbsensi: async (id: number) => {
        const response = await api.delete(`/absensi/${id}`);
        return response.data;
    },

    // =============================================
    // KASBON METHODS
    // =============================================
    getKasbonList: async (params?: {
        skip?: number;
        limit?: number;
        karyawan_id?: number;
        status?: PaymentStatus;
        tanggal_dari?: string;
        tanggal_sampai?: string;
    }) => {
        const response = await api.get('/kasbon', { params });
        return response.data;
    },

    getKasbonSummary: async (params?: { tanggal_dari?: string; tanggal_sampai?: string }): Promise<KasbonSummary> => {
        const response = await api.get('/kasbon/summary', { params });
        return response.data;
    },

    getTopDebtors: async (limit: number = 10) => {
        const response = await api.get('/kasbon/top-debtors', { params: { limit } });
        return response.data;
    },

    getEmployeeKasbon: async (karyawanId: number, unpaidOnly: boolean = true) => {
        const response = await api.get(`/kasbon/karyawan/${karyawanId}`, { params: { unpaid_only: unpaidOnly } });
        return response.data;
    },

    getEmployeeKasbonTotal: async (karyawanId: number): Promise<{ karyawan_id: number; total_kasbon: number }> => {
        const response = await api.get(`/kasbon/karyawan/${karyawanId}/total`);
        return response.data;
    },

    createKasbon: async (data: { karyawan_id: number; tanggal: string; nominal: number; metode_bayar: string; keterangan?: string }): Promise<Kasbon> => {
        const response = await api.post('/kasbon', data);
        return response.data;
    },

    markKasbonPaid: async (id: number, tanggalLunas?: string): Promise<Kasbon> => {
        const params = tanggalLunas ? { tanggal_lunas: tanggalLunas } : {};
        const response = await api.patch(`/kasbon/${id}/paid`, null, { params });
        return response.data;
    },

    deleteKasbon: async (id: number) => {
        const response = await api.delete(`/kasbon/${id}`);
        return response.data;
    },

    // =============================================
    // SLIP GAJI METHODS (Weekly Payroll)
    // =============================================
    getSlipGajiList: async (params?: {
        skip?: number;
        limit?: number;
        karyawan_id?: number;
        periode_minggu?: number;
        periode_tahun?: number;
        status?: PaymentStatus;
    }) => {
        const response = await api.get('/slip-gaji', { params });
        return response.data;
    },

    getSlipGaji: async (id: number): Promise<SlipGaji> => {
        const response = await api.get(`/slip-gaji/${id}`);
        return response.data;
    },

    getSlipGajiWeeklySummary: async (tahun: number, minggu: number): Promise<SlipGajiWeeklySummary> => {
        const response = await api.get(`/slip-gaji/summary/${tahun}/${minggu}`);
        return response.data;
    },

    getSlipGajiPreview: async (tahun: number, minggu: number): Promise<SlipGajiPreview> => {
        const response = await api.get(`/slip-gaji/preview/${tahun}/${minggu}`);
        return response.data;
    },

    getSlipGajiPreviewRange: async (tanggalDari: string, tanggalSampai: string): Promise<SlipGajiPreview> => {
        const response = await api.get('/slip-gaji/preview-range', {
            params: { tanggal_dari: tanggalDari, tanggal_sampai: tanggalSampai }
        });
        return response.data;
    },

    createSlipGaji: async (data: Partial<SlipGaji>): Promise<SlipGaji> => {
        const response = await api.post('/slip-gaji', data);
        return response.data;
    },

    createBulkSlipGaji: async (tahun: number, minggu: number, items?: SlipGajiPreviewItem[], tanggalMulai?: string) => {
        const data = {
            items: items ? items.map(i => ({ karyawan_id: i.karyawan_id, jumlah_hadir: i.jumlah_hadir })) : undefined,
            tanggal_mulai: tanggalMulai
        };
        const response = await api.post(`/slip-gaji/bulk/${tahun}/${minggu}`, data);
        return response.data;
    },

    createBulkSlipGajiRange: async (tanggalDari: string, tanggalSampai: string, items?: SlipGajiPreviewItem[]) => {
        const data = {
            items: items ? items.map(i => ({ karyawan_id: i.karyawan_id, jumlah_hadir: i.jumlah_hadir })) : undefined,
        };
        const response = await api.post('/slip-gaji/bulk-range', data, {
            params: { tanggal_dari: tanggalDari, tanggal_sampai: tanggalSampai }
        });
        return response.data;
    },

    processSlipGajiPayment: async (id: number, data: { metode_bayar: string; catatan?: string }): Promise<SlipGaji> => {
        const response = await api.post(`/slip-gaji/${id}/pay`, data);
        return response.data;
    },

    deleteSlipGaji: async (id: number) => {
        const response = await api.delete(`/slip-gaji/${id}`);
        return response.data;
    },
};
