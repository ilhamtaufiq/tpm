export const ALWAYS_READY_STOCK = '999';

/** Stok 999 = Always Ready (katalog tanpa stok fisik). */
export function isAlwaysReadyStock(stok: unknown): boolean {
    if (stok === null || stok === undefined || stok === '') return false;
    const n = Number(stok);
    return Number.isFinite(n) && n === 999;
}