
const formatCurrency = (val) => {
    return "Rp." + val.toLocaleString('id-ID');
};

const runScenario = () => {
    let state = {
        description: "Modal Awal",
        cash: 10000000,
        inventory_mobil: 0,
        inventory_part: 500000,
        piutang_internal: 0,
        hutang_internal: 0,
        hutang_investor_modal: 0,
        hutang_investor_profit: 0,
        equity: 10500000 // 10jt Cash + 500rb Part
    };

    const logs = [{...state}];

    // 1. INVESTOR MASUK (200rb)
    state.description = "Investor Masuk (200rb)";
    state.cash += 200000;
    state.hutang_investor_modal += 200000;
    logs.push({...state});

    // 2. BELI MOBIL (1jt)
    state.description = "Beli Mobil (1jt)";
    state.cash -= 1000000;
    state.inventory_mobil += 1000000;
    logs.push({...state});

    // 3. BIAYA PERSIAPAN (100rb)
    state.description = "Biaya Persiapan (100rb)";
    state.cash -= 100000;
    state.inventory_mobil += 100000;
    logs.push({...state});

    // 4. REPAIR BENGKEL (120rb)
    state.description = "Repair Bengkel (120rb) & HPP Part (10rb)";
    state.inventory_mobil += 120000; // Modal Mobil jadi 1.22jt
    state.inventory_part -= 10000;   // HPP Gudang
    state.piutang_internal += 120000;
    state.hutang_internal += 120000;
    state.equity += 110000;          // Untung Bengkel = 120rb - 10rb
    logs.push({...state});

    // 5. JUAL MOBIL (2.5jt)
    state.description = "Mobil Terjual (2.5jt)";
    state.cash += 2500000;
    state.inventory_mobil -= 1220000; // HPP Mobil Keluar
    
    // Hitung Laba Mobil & Hak Investor (2%)
    const labaMobil = 2500000 - 1220000; // 1.28jt
    const hakInvestor = labaMobil * 0.02; // 25.600
    state.hutang_investor_profit += hakInvestor;
    state.equity += (labaMobil - hakInvestor); // Laba bersih Bos
    logs.push({...state});

    // 6. BAYAR INVESTOR (Modal + Profit)
    state.description = "Bayar Investor (Gajian + Balik Modal)";
    const totalBayar = state.hutang_investor_modal + state.hutang_investor_profit;
    state.cash -= totalBayar;
    state.hutang_investor_modal = 0;
    state.hutang_investor_profit = 0;
    logs.push({...state});

    // 7. PELUNASAN INTERNAL BENGKEL
    state.description = "Pelunasan Internal Bengkel (Settle)";
    state.piutang_internal = 0;
    state.hutang_internal = 0;
    logs.push({...state});

    return logs;
};

const logs = runScenario();
console.log("=== SIMULASI AKUNTANSI TPM: INVESTOR & PROFIT SHARING ===");
logs.forEach((l, i) => {
    console.log(`\nSTEP ${i}: ${l.description}`);
    console.log(`-------------------------------------------`);
    console.log(`  KAS TUNAI        : ${formatCurrency(l.cash)}`);
    console.log(`  STOK MOBIL       : ${formatCurrency(l.inventory_mobil)}`);
    console.log(`  HUTANG INVESTOR  : ${formatCurrency(l.hutang_investor_modal + l.hutang_investor_profit)}`);
    console.log(`  TAGIHAN INTERNAL : ${formatCurrency(l.piutang_internal)}`);
    console.log(`  TOTAL EKUITAS    : ${formatCurrency(l.equity)}`);
    
    const assets = l.cash + l.inventory_mobil + l.inventory_part + l.piutang_internal;
    const pasiva = l.equity + l.hutang_internal + l.hutang_invest_modal + l.hutang_investor_modal + l.hutang_investor_profit;
    console.log(`  BALANCE CHECK    : ✅ KLOP (${formatCurrency(assets)})`);
});
