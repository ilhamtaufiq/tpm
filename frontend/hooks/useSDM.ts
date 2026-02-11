import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sdmService } from '../services/sdm';

// =============================================
// KARYAWAN
// =============================================
export const useKaryawanList = (params?: any) => {
    return useQuery({
        queryKey: ['karyawan', params],
        queryFn: () => sdmService.getKaryawanList(params),
    });
};

export const useActiveKaryawan = () => {
    return useQuery({
        queryKey: ['karyawan_active'],
        queryFn: () => sdmService.getActiveKaryawan(),
    });
};

export const useKaryawanSummary = (id: number) => {
    return useQuery({
        queryKey: ['karyawan_summary', id],
        queryFn: () => sdmService.getKaryawanSummary(id),
        enabled: !!id,
    });
};

export const useEmployeeStats = () => {
    return useQuery({
        queryKey: ['employee_stats'],
        queryFn: () => sdmService.getEmployeeStats(),
    });
};

export const useCreateKaryawan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: sdmService.createKaryawan,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['karyawan'] });
            queryClient.invalidateQueries({ queryKey: ['karyawan_summary'] });
        },
    });
};

export const useUpdateKaryawan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            sdmService.updateKaryawan(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['karyawan'] });
        },
    });
};

// =============================================
// ABSENSI
// =============================================
export const useAbsensiHarian = (tanggal: string) => {
    return useQuery({
        queryKey: ['absensi_harian', tanggal],
        queryFn: () => sdmService.getDailyAttendance(tanggal),
        enabled: !!tanggal,
    });
};

export const useAbsensiBulanan = (karyawanId: number, tahun: number, bulan: number) => {
    return useQuery({
        queryKey: ['absensi_bulanan', karyawanId, tahun, bulan],
        queryFn: () => sdmService.getMonthlyAttendance(karyawanId, tahun, bulan),
        enabled: !!karyawanId,
    });
};

export const useClockIn = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (karyawanId: number) => sdmService.clockIn(karyawanId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['absensi_harian'] });
        },
    });
};

export const useClockOut = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => sdmService.clockOut(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['absensi_harian'] });
        },
    });
};

// =============================================
// KASBON
// =============================================
export const useKasbonList = (params?: any) => {
    return useQuery({
        queryKey: ['kasbon', params],
        queryFn: () => sdmService.getKasbonList(params),
    });
};

export const useKasbonSummary = () => {
    return useQuery({
        queryKey: ['kasbon_summary'],
        queryFn: () => sdmService.getKasbonSummary(),
    });
};

export const useCreateKasbon = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: sdmService.createKasbon,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kasbon'] });
            queryClient.invalidateQueries({ queryKey: ['kasbon_summary'] });
        },
    });
};

export const useMarkKasbonPaid = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => sdmService.markKasbonPaid(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kasbon'] });
            queryClient.invalidateQueries({ queryKey: ['kasbon_summary'] });
        },
    });
};

// =============================================
// SLIP GAJI (Weekly Payroll)
// =============================================
export const useSlipGajiList = (params?: any) => {
    return useQuery({
        queryKey: ['slip_gaji', params],
        queryFn: () => sdmService.getSlipGajiList(params),
    });
};

export const useSlipGajiWeeklySummary = (tahun: number, minggu: number) => {
    return useQuery({
        queryKey: ['slip_gaji_weekly', tahun, minggu],
        queryFn: () => sdmService.getSlipGajiWeeklySummary(tahun, minggu),
    });
};

export const useSlipGajiPreview = (tahun: number, minggu: number, enabled: boolean = false) => {
    return useQuery({
        queryKey: ['slip_gaji_preview', tahun, minggu],
        queryFn: () => sdmService.getSlipGajiPreview(tahun, minggu),
        enabled,
    });
};

export const useCreateBulkSlipGaji = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tahun, minggu, items, tanggalMulai }: { tahun: number; minggu: number; items?: any[]; tanggalMulai?: string }) =>
            sdmService.createBulkSlipGaji(tahun, minggu, items, tanggalMulai),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slip_gaji'] });
            queryClient.invalidateQueries({ queryKey: ['slip_gaji_preview'] });
        },
    });
};

export const useProcessSlipGajiPayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            sdmService.processSlipGajiPayment(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slip_gaji'] });
            queryClient.invalidateQueries({ queryKey: ['slip_gaji_weekly'] });
        },
    });
};

// =============================================
// PAYROLL ALIASES (for slip-gaji.tsx compatibility)
// =============================================
export const usePayrollList = useSlipGajiList;
export const usePayrollSummary = useSlipGajiWeeklySummary;
export const useCreatePayroll = useCreateBulkSlipGaji;
export const useProcessPayrollPayment = useProcessSlipGajiPayment;
