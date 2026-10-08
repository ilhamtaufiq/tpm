import { MutationCache, QueryClient } from '@tanstack/react-query';

/**
 * Laporan keuangan yang berubah oleh hampir semua mutasi (kas, piutang, hutang,
 * pembelian part, gaji, penjualan, dll). Ditandai basi setiap mutasi sukses,
 * supaya Neraca/Laba Rugi/Perubahan Modal tidak menampilkan angka lama sampai
 * staleTime habis atau user tarik-untuk-refresh. Tidak semua modul mengirim event
 * realtime (WS) ke scope finance, jadi invalidasi di sisi klien wajib.
 */
const FINANCE_REPORT_KEYS = [
    'neraca_report',
    'laba_rugi_report',
    'perubahan_modal_report',
    'capital_report',
    'validate_reports',
    'dashboard_summary',
    'recent_activity',
] as const;

/**
 * Single app-wide QueryClient.
 * Lives in its own module so stores (auth logout) can clear the cache
 * without importing the root layout.
 */
export const queryClient = new QueryClient({
    mutationCache: new MutationCache({
        onSuccess: () => {
            FINANCE_REPORT_KEYS.forEach((key) => {
                queryClient.invalidateQueries({ queryKey: [key] });
            });
        },
    }),
    defaultOptions: {
        queries: {
            // Avoid network storm when switching menus: cache is "fresh" for 60s.
            // Realtime WS + pull-to-refresh still update sooner when needed.
            staleTime: 1000 * 60,
            // 24 hours until garbage collected from storage
            gcTime: 1000 * 60 * 60 * 24,
            // Only refetch focused queries if data is actually stale
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchOnMount: true,
            networkMode: 'offlineFirst',
            // Standard retry logic
            retry: (failureCount, error: any) => {
                if (error?.message?.includes('network')) return false;
                return failureCount < 2;
            },
        },
        mutations: {
            // Paused mutations are a fallback; durable queue is source of truth for offline writes
            networkMode: 'online',
            retry: 0,
        },
    },
});
