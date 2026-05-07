
const formatCurrency = (val) => {
    return "Rp." + val.toLocaleString('id-ID');
};

const runMegaCycle = () => {
    let state = {
        description: "Modal Awal",
        cash: 20000000, // 20jt
        inv_mobil: 0,
        inv_part: 1000000, // 1jt stok part
        piutang_int: 0,
        piutang_ext: 0,
        hutang_int: 0,
        hutang_inv: 0,
        equity: 21000000 // 20jt Cash + 1jt Part
    };

    const logs = [{...state}];

    // 1. BELI UNIT (5jt) + INVESTOR MASUK (2jt)
    state.description = "Beli Unit (5jt) & Investor Support (2jt)";
    state.cash += 2000000; // Investor masuk
    state.hutang_inv += 2000000;
    state.cash -= 5000000; // Bayar unit
    state.inv_mobil += 5000000;
    logs.push({...state});

    // 2. JASA ANGKUT (Internal) - Towing Unit
    state.description = "JA Towing Unit (200rb) - Tagihan Internal";
    state.inv_mobil += 200000; // Biaya towing nempel ke unit
    state.piutang_int += 200000; // JA punya tagihan
    state.hutang_int += 200000; // Mobil punya hutang ke JA
    state.equity += 200000; // Laba JA (full jasa)
    logs.push({...state});

    // 3. BENGKEL REPAIR (Internal)
    state.description = "Bengkel Repair Unit (400rb) - Tagihan Internal";
    state.inv_mobil += 400000; // Modal unit naik
    state.inv_part -= 200000; // HPP Part 200rb
    state.piutang_int += 400000; // Bengkel punya tagihan
    state.hutang_int += 400000; // Mobil punya hutang ke Bengkel
    state.equity += (400000 - 200000); // Laba Bengkel 200rb
    logs.push({...state});

    // 4. BENGKEL EXTERNAL (Ada Orang Luar Ganti Oli)
    state.description = "Bengkel Terima Tamu Luar (300rb) - Cash";
    state.cash += 300000;
    state.inv_part -= 100000; // HPP Oli 100rb
    state.equity += (300000 - 100000); // Laba 200rb
    logs.push({...state});

    // 5. JUAL UNIT (8jt)
    state.description = "Unit Terjual (8jt) - Profit Sharing 5%";
    state.cash += 8000000;
    const hppMobil = 5600000; // 5jt + 200k JA + 400k Repair
    state.inv_mobil -= hppMobil;
    const labaMobil = 8000000 - hppMobil; // 2.4jt
    const hakInv = labaMobil * 0.05; // 120rb
    state.hutang_inv += hakInv;
    state.equity += (labaMobil - hakInv);
    logs.push({...state});

    // 6. SETTLE SEMUA (Investor & Internal)
    state.description = "Settle Semua Hutang & Piutang";
    state.cash -= (state.hutang_inv); // Bayar Investor
    state.hutang_inv = 0;
    state.piutang_int = 0;
    state.hutang_int = 0;
    logs.push({...state});

    return logs;
};

const logs = runMegaCycle();
console.log("=== TPM MEGA CYCLE: STRESS TEST SEMUA UNIT ===");
logs.forEach((l, i) => {
    console.log(`\nSTEP ${i}: ${l.description}`);
    console.log(`-------------------------------------------`);
    console.log(`  KAS TUNAI        : ${formatCurrency(l.cash)}`);
    console.log(`  STOK MOBIL       : ${formatCurrency(l.inv_mobil)}`);
    console.log(`  HUTANG INVESTOR  : ${formatCurrency(l.hutang_inv)}`);
    console.log(`  TAGIHAN INTERNAL : ${formatCurrency(l.piutang_int)}`);
    console.log(`  TOTAL EKUITAS    : ${formatCurrency(l.equity)}`);
    
    const assets = l.cash + l.inv_mobil + l.inv_part + l.piutang_int;
    const pasiva = l.equity + l.hutang_int + l.hutang_inv;
    console.log(`  BALANCE CHECK    : ${Math.abs(assets-pasiva) < 1 ? '✅ KLOP' : '❌ SELISIH'} (${formatCurrency(assets)})`);
});
