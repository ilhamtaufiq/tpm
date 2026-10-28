import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pembatalanService } from '../services/pembatalan';

const KUNCI_TERDAMPAK = [
    'kas_bank_list',
    'kas_bank_balances',
    'pembatalan_list',
    'dashboard_summary',
    'transaksi_bengkel_summary',
    'piutang_list',
    'pengeluaran_list',
];

export const usePembatalanList = (jenis?: string) => {
    return useQuery({
        queryKey: ['pembatalan_list', jenis],
        queryFn: () => pembatalanService.listRiwayat(jenis),
    });
};

/** Baris riwayat dompet unit: id negatif = pengeluaran (lihat utils/walletMerge). */
export const useBatalkanBaris = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ item, alasan }: { item: any; alasan: string }) =>
            Number(item.id) < 0
                ? pembatalanService.batalkanPengeluaran(Number(item.referensi_id), alasan)
                : pembatalanService.batalkanKas(Number(item.id), alasan),
        onSuccess: () => {
            KUNCI_TERDAMPAK.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
            queryClient.invalidateQueries({ queryKey: ['pengeluaran'] });
        },
    });
};

export const useBatalkanKas = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ kasId, alasan }: { kasId: number; alasan: string }) =>
            pembatalanService.batalkanKas(kasId, alasan),
        onSuccess: () => {
            KUNCI_TERDAMPAK.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
        },
    });
};
