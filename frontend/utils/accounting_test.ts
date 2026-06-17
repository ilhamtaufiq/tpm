
/**
 * ACCOUNTING SCENARIO TEST: INTERNAL UNIT BALANCING
 * Scenario: Mobil 1jt + Prep 100rb + Workshop 400rb = Total 1.5jt
 */

import { formatCurrency } from './format';

interface Transaction {
    description: string;
    cash: number;
    inventory: number;
    piutang_internal: number;
    hutang_internal: number;
    equity: number;
}

export const runAccountingTest = () => {
    let state: Transaction = {
        description: "Modal Awal",
        cash: 2000000, // 2jt
        inventory: 0,
        piutang_internal: 0,
        hutang_internal: 0,
        equity: 2000000
    };

    const results: Transaction[] = [ { ...state } ];

    // 1. BELI MOBIL (1jt)
    state.description = "Beli Mobil (1jt)";
    state.cash -= 1000000;
    state.inventory += 1000000;
    results.push({ ...state });

    // 2. BIAYA PERSIAPAN (100rb) - Tunai
    state.description = "Biaya Persiapan/Pajak (100rb)";
    state.cash -= 1000000; // Pembayaran real
    state.inventory += 100000;
    results.push({ ...state });

    // 3. PERBAIKAN BENGKEL (400rb) - INTERNAL DEBT
    state.description = "Perbaikan Bengkel (Internal Debt 400rb)";
    state.inventory += 400000; // Nilai mobil naik jadi 1.5jt
    state.hutang_internal += 400000; // Mobil hutang ke bengkel
    state.piutang_internal += 400000; // Bengkel punya piutang ke mobil
    // Laba bengkel diakui (Profit 400rb dari jasa/parts internal)
    state.equity += 400000; 
    results.push({ ...state });

    // 4. JUAL MOBIL (2.5jt) & LUNAS
    state.description = "Mobil Terjual (2.5jt) & Pelunasan Internal";
    state.cash += 2500000;
    state.inventory -= 1500000; // HPP 1.5jt keluar
    
    // OTOMATISASI: Hutang & Piutang Hilang
    state.hutang_internal = 0;
    state.piutang_internal = 0;
    
    // Laba Jual Mobil (2.5jt - 1.5jt = 1jt)
    state.equity += 1000000;
    results.push({ ...state });

    return results;
};

export const printTestResults = () => {
    const logs = runAccountingTest();
    console.log("=== TPM ACCOUNTING TEST REPORT ===");
    logs.forEach(l => {
        console.log(`\n[${l.description}]`);
        console.log(`- Kas: ${formatCurrency(l.cash)}`);
        console.log(`- Stok Mobil: ${formatCurrency(l.inventory)}`);
        console.log(`- Piutang Internal: ${formatCurrency(l.piutang_internal)}`);
        console.log(`- Hutang Internal: ${formatCurrency(l.hutang_internal)}`);
        console.log(`- Total Ekuitas: ${formatCurrency(l.equity)}`);
        const assets = l.cash + l.inventory + l.piutang_internal;
        const pasiva = l.equity + l.hutang_internal;
        console.log(`=> Balance Check: ${assets === pasiva ? '✅ KLOP' : '❌ SELISIH'} (${formatCurrency(assets)})`);
    });
};
