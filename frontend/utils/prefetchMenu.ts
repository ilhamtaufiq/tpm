import type { QueryClient } from '@tanstack/react-query';
import { format, startOfMonth, subMonths } from 'date-fns';
import { bengkelService } from '../services/bengkel';
import { mobilService } from '../services/mobil';
import { jasaAngkutService } from '../services/jasaAngkut';
import { keuanganService } from '../services/keuangan';

const today = () => format(new Date(), 'yyyy-MM-dd');
const monthStart = () => format(startOfMonth(new Date()), 'yyyy-MM-dd');
const monthAgo = () => format(subMonths(new Date(), 1), 'yyyy-MM-dd');

/**
 * Preload lazy unit screen modules (static paths required for Metro code-splitting).
 * Fire-and-forget — never throws to caller.
 */
export function preloadUnitScreen(path: string): void {
    const clean = (path || '').split('?')[0];
    try {
        if (clean === '/bengkel' || clean.startsWith('/bengkel')) {
            // @ts-expect-error project tsc module target is older; Metro supports import()
            void import('../app/bengkel/BengkelHomeContent');
        } else if (clean === '/jasa-angkut' || clean.startsWith('/jasa-angkut')) {
            // @ts-expect-error project tsc module target is older; Metro supports import()
            void import('../app/jasa-angkut/JasaAngkutHomeContent');
        } else if (clean === '/mobil' || clean.startsWith('/mobil')) {
            // @ts-expect-error project tsc module target is older; Metro supports import()
            void import('../app/mobil/MobilHomeContent');
        }
    } catch {
        // non-fatal
    }
}

/**
 * Warm React Query cache before navigating to a heavy unit menu.
 * Fire-and-forget — never blocks navigation.
 */
export function prefetchMenu(queryClient: QueryClient, path: string): void {
    const clean = (path || '').split('?')[0];
    preloadUnitScreen(clean);

    try {
        if (clean === '/home' || clean === '/' || clean === '/(tabs)/home') {
            void queryClient.prefetchQuery({
                queryKey: ['kas_bank_balances'],
                queryFn: () => keuanganService.getKasBankBalances(),
                staleTime: 1000 * 30,
            });
            void queryClient.prefetchQuery({
                queryKey: ['recent_activity', 10],
                queryFn: () => keuanganService.getRecentActivity(10),
                staleTime: 1000 * 30,
            });
            return;
        }

        if (clean === '/bengkel' || clean.startsWith('/bengkel')) {
            const dari = today();
            const sampai = today();
            void queryClient.prefetchQuery({
                queryKey: ['transaksi_bengkel', { tanggal_dari: dari, tanggal_sampai: sampai }],
                queryFn: () => bengkelService.getTransaksi({ tanggal_dari: dari, tanggal_sampai: sampai }),
            });
            void queryClient.prefetchQuery({
                queryKey: ['transaksi_bengkel_summary', { tanggal_dari: dari, tanggal_sampai: sampai }],
                queryFn: () => bengkelService.getTransaksiSummary({ tanggal_dari: dari, tanggal_sampai: sampai }),
            });
            void queryClient.prefetchQuery({
                queryKey: ['kas_bank_balances'],
                queryFn: () => keuanganService.getKasBankBalances(),
                staleTime: 1000 * 30,
            });
            return;
        }

        if (clean === '/mobil' || clean.startsWith('/mobil')) {
            // Must match MobilHomeContent default useMobilList params exactly
            const mobilParams = {
                status: undefined as undefined,
                status_bayar: 'ALL' as const,
                search: '',
                tanggal_dari: undefined as undefined,
                tanggal_sampai: undefined as undefined,
            };
            void queryClient.prefetchQuery({
                queryKey: ['mobils', mobilParams],
                queryFn: () => mobilService.getMobils(mobilParams),
            });
            void queryClient.prefetchQuery({
                queryKey: ['mobils_summary'],
                queryFn: () => mobilService.getInventorySummary(),
            });
            const penParams = {
                search: '',
                tanggal_dari: monthAgo(),
                tanggal_sampai: today(),
            };
            void queryClient.prefetchQuery({
                queryKey: ['penjualan_mobil_summary', penParams],
                queryFn: () => mobilService.getPenjualanSummary(penParams),
            });
            void queryClient.prefetchQuery({
                queryKey: ['kas_bank_balances'],
                queryFn: () => keuanganService.getKasBankBalances(),
                staleTime: 1000 * 30,
            });
            return;
        }

        if (clean === '/jasa-angkut' || clean.startsWith('/jasa-angkut')) {
            const dari = monthStart();
            const sampai = today();
            void queryClient.prefetchQuery({
                queryKey: ['muatan', { limit: 40, tanggal_dari: dari, tanggal_sampai: sampai }],
                queryFn: () => jasaAngkutService.getMuatanList({ limit: 40, tanggal_dari: dari, tanggal_sampai: sampai }),
            });
            void queryClient.prefetchQuery({
                queryKey: ['muatan_summary', { search: '', tanggal_dari: dari, tanggal_sampai: sampai }],
                queryFn: () => jasaAngkutService.getMuatanSummary({ search: '', tanggal_dari: dari, tanggal_sampai: sampai }),
            });
            void queryClient.prefetchQuery({
                queryKey: ['kas_bank_balances'],
                queryFn: () => keuanganService.getKasBankBalances(),
                staleTime: 1000 * 30,
            });
            return;
        }

        if (clean.includes('/finance') || clean === '/history') {
            void queryClient.prefetchQuery({
                queryKey: ['kas_bank_balances'],
                queryFn: () => keuanganService.getKasBankBalances(),
                staleTime: 1000 * 30,
            });
        }
    } catch (e) {
        // Prefetch must never break navigation
        console.warn('[prefetchMenu]', e);
    }
}

/** Map bottom-tab route ids / paths for prefetch on press. */
export function pathForPrefetch(path: string): string {
    if (path === '/home') return '/home';
    return path.split('?')[0];
}

// silence unused helper in tree-shake edge cases
void monthAgo;
