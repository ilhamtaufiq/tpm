
const formatCurrency = (val) => {
    return "Rp." + val.toLocaleString('id-ID');
};

const runScenario = () => {
    let state = {
        description: "Modal Awal",
        cash: 5000000,
        inventory_mobil: 0,
        inventory_part: 500000, // Bos punya stok sparepart senilai 500rb
        piutang_internal: 0,
        piutang_customer: 0,
        hutang_internal: 0,
        equity: 5500000 // Total Modal = 5jt Cash + 500rb Part
    };

    const logs = [{...state}];

    // 1. BELI MOBIL (1jt)
    state.description = "Beli Mobil Avanza (1jt)";
    state.cash -= 1000000;
    state.inventory_mobil += 1000000;
    logs.push({...state});

    // 2. BIAYA PERSIAPAN (100rb)
    state.description = "Biaya Pajak & Persiapan (100rb)";
    state.cash -= 100000;
    state.inventory_mobil += 100000;
    logs.push({...state});

    // 3. PERBAIKAN BENGKEL (110rb)
    state.description = "Repair Bengkel (110rb) & HPP Part (5rb)";
    state.inventory_mobil += 110000; // Nilai mobil naik
    state.inventory_part -= 5000;   // Stok gudang berkurang (HPP)
    state.piutang_internal += 110000; // Tagihan bengkel
    state.hutang_internal += 110000; // Hutang mobil
    state.equity += 105000;         // Laba = 110rb (Revenue) - 5rb (HPP)
    logs.push({...state});

    // 4. JUAL MOBIL (2jt) - DP 1jt
    state.description = "Jual Mobil (2jt) - DP 1jt Diterima";
    state.cash += 1000000; // DP Masuk
    state.piutang_customer += 1000000; // Sisa piutang
    state.inventory_mobil -= 1210000; // HPP Unit Keluar
    state.equity += (2000000 - 1210000); // Laba Jual (790rb)
    logs.push({...state});

    // 5. PELUNASAN INTERNAL
    state.description = "Pelunasan Internal (Hutang Bengkel Lunas)";
    state.piutang_internal -= 110000;
    state.hutang_internal -= 110000;
    logs.push({...state});

    return logs;
};

const logs = runScenario();
console.log("=== SIMULASI AKUNTANSI TPM (KLOP VERSION) ===");
logs.forEach((l, i) => {
    console.log(`\nSTEP ${i}: ${l.description}`);
    console.log(`-------------------------------------------`);
    console.log(`  KAS TUNAI        : ${formatCurrency(l.cash)}`);
    console.log(`  STOK MOBIL       : ${formatCurrency(l.inventory_mobil)}`);
    console.log(`  STOK SPAREPART   : ${formatCurrency(l.inventory_part)}`);
    console.log(`  PIUTANG CUSTOMER : ${formatCurrency(l.piutang_customer)}`);
    console.log(`  TAGIHAN INTERNAL : ${formatCurrency(l.piutang_internal)}`);
    console.log(`  HUTANG INTERNAL  : ${formatCurrency(l.hutang_internal)}`);
    console.log(`  TOTAL EKUITAS    : ${formatCurrency(l.equity)}`);
    
    const assets = l.cash + l.inventory_mobil + l.inventory_part + l.piutang_internal + l.piutang_customer;
    const pasiva = l.equity + l.hutang_internal;
    console.log(`  BALANCE CHECK    : ${assets === pasiva ? '✅ KLOP' : '❌ SELISIH'} (${formatCurrency(assets)})`);
});
