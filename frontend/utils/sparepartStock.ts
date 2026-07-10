/** Always Ready = katalog tanpa stok fisik. Bukan 999: stok fisik bisa 999 (mis. sikring). */
export const ALWAYS_READY_STOCK = '999999';

/** Stok 999999 = Always Ready (katalog tanpa stok fisik). */
export function isAlwaysReadyStock(stok: unknown): boolean {
    if (stok === null || stok === undefined || stok === '') return false;
    const n = Number(stok);
    return Number.isFinite(n) && n === 999999;
}
