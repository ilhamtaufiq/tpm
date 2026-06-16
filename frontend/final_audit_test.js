
const formatCurrency = (val) => {
    return "Rp." + val.toLocaleString('id-ID');
};

const runFinalAudit = () => {
    let state = {
        description: "Modal Awal",
        cash: 10000000,
        inv_part: 500000,
        piutang_int: 0,
        hutang_int: 0,
        equity: 10500000
    };

    const logs = [{...state}];

    // 1. JA KIRIM PASIR (Jual 1jt, Beli 600rb)
    state.description = "JA Kirim Pasir (Jual 1jt, Beli 600rb)";
    const pendapatanKotor = 1000000 - 600000; // 400rb
    state.cash += 400000; // Net Cash Flow dari selisih jual-beli
    logs.push({...state});

    // 2. BIAYA JALAN (Solar 100rb)
    state.description = "Biaya Solar JA (100rb)";
    state.cash -= 100000;
    logs.push({...state});

    // 3. INSIDEN: SERVIS DI BENGKEL TPM (50rb)
    state.description = "Servis Truk di Bengkel TPM (50rb) - Internal";
    state.piutang_int += 50000; // Bengkel menagih
    state.hutang_int += 50000;  // JA berhutang
    state.inv_part -= 10000;    // HPP Part Bengkel (misal 10rb)
    state.equity += (50000 - 10000); // Laba Bengkel 40000
    logs.push({...state});

    // 4. BAGI HASIL SUPIR (50% dari 400rb = 200rb)
    state.description = "Bayar Jatah Supir JA (200rb)";
    state.cash -= 200000;
    logs.push({...state});

    // 5. PENUTUPAN: Laba Bersih TPM dari JA
    // (400rb - 200rb supir - 100rb solar - 50rb bengkel) = 50rb
    state.description = "Laba Bersih Akhir JA (50rb)";
    state.equity += 50000; 
    logs.push({...state});

    return logs;
};

const logs = runFinalAudit();
console.log("=== FINAL AUDIT TPM: UNIT JASA ANGKUT & BENGKEL ===");
logs.forEach((l, i) => {
    console.log(`\nSTEP ${i}: ${l.description}`);
    console.log(`-------------------------------------------`);
    console.log(`  KAS TUNAI        : ${formatCurrency(l.cash)}`);
    console.log(`  HUTANG INTERNAL  : ${formatCurrency(l.hutang_int)}`);
    console.log(`  TAGIHAN INTERNAL : ${formatCurrency(l.piutang_int)}`);
    console.log(`  TOTAL EKUITAS    : ${formatCurrency(l.equity)}`);
    
    const assets = l.cash + l.inv_part + l.piutang_int;
    const pasiva = l.equity + l.hutang_int;
    console.log(`  BALANCE CHECK    : ${Math.abs(assets-pasiva) < 1 ? '✅ KLOP' : '❌ SELISIH'} (${formatCurrency(assets)})`);
});
