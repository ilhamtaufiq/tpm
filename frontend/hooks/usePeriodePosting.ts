import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { periodePostingService } from '../services/periodePosting';

const KUNCI_TERDAMPAK = ['periode_posting', 'transaksi_bengkel_list', 'transaksi_bengkel_summary', 'dashboard_summary'];

export const usePeriodePostingList = (tahun?: number) =>
    useQuery({
        queryKey: ['periode_posting', tahun],
        queryFn: () => periodePostingService.list(tahun),
    });

export const usePostingPeriode = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tahun, bulan, catatan }: { tahun: number; bulan: number; catatan?: string }) =>
            periodePostingService.posting(tahun, bulan, catatan),
        onSuccess: () => KUNCI_TERDAMPAK.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    });
};

export const useBukaKembaliPeriode = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tahun, bulan, alasan }: { tahun: number; bulan: number; alasan: string }) =>
            periodePostingService.bukaKembali(tahun, bulan, alasan),
        onSuccess: () => KUNCI_TERDAMPAK.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    });
};
