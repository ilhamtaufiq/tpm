
const axios = require('axios');

const API_URL = 'http://localhost:8000'; // Adjust as needed
let TOKEN = '';

async function login() {
    try {
        const response = await axios.post(`${API_URL}/api/v1/auth/login`, {
            username: 'admin',
            password: 'adminpassword'
        });
        TOKEN = response.data.access_token;
        axios.defaults.headers.common['Authorization'] = `Bearer ${TOKEN}`;
        console.log('✅ Login successful');
    } catch (error) {
        console.error('❌ Login failed:', error.message);
        process.exit(1);
    }
}

async function runTest() {
    await login();

    console.log('\n🚀 Starting Jasa Angkut Accounting Test...');

    try {
        // 1. Setup Data Master (Supir & Armada)
        console.log('--- 1. Setup Master Data ---');
        const supirRes = await axios.post(`${API_URL}/api/v1/jasa-angkut/supir`, {
            kode: 'SUP-' + Date.now(),
            nama: 'Supir Test JA',
            tanggal_bergabung: '2024-01-01',
            is_active: true
        });
        const supirId = supirRes.data.id;
        console.log(`✅ Supir created: ID ${supirId}`);

        const armadaRes = await axios.post(`${API_URL}/api/v1/jasa-angkut/armada`, {
            nama: 'Truk Test JA',
            nopol: 'B ' + Math.floor(Math.random() * 9000 + 1000) + ' TEST',
            jenis: 'Colt Diesel',
            is_active: true
        });
        const armadaId = armadaRes.data.id;
        console.log(`✅ Armada created: ID ${armadaId}`);

        // 2. Create Muatan (Trip)
        console.log('\n--- 2. Create Muatan (Trip) ---');
        // Scenario: Jual 1.5jt, Beli 500k -> Gross Margin 1jt. Split 50/50.
        const muatanRes = await axios.post(`${API_URL}/api/v1/jasa-angkut/muatan`, {
            tanggal: new Date().toISOString().split('T')[0],
            supir_id: supirId,
            armada_id: armadaId,
            asal: 'Gudang A',
            tujuan: 'Pabrik B',
            jenis_muatan: 'Pasir',
            harga_beli: 500000,
            harga_jual: 1500000,
            persentase_tpm: 50,
            biaya_operasional: [
                { deskripsi: 'BBM', jumlah: 100000 },
                { deskripsi: 'Tol', jumlah: 50000 }
            ],
            status_bayar: 'BELUM_LUNAS'
        });
        const muatanId = muatanRes.data.id;
        const nomorMuatan = muatanRes.data.nomor_transaksi;
        console.log(`✅ Muatan created: ${nomorMuatan} (ID: ${muatanId})`);
        console.log(`   Laba Supir (50%): ${muatanRes.data.laba_supir}`);
        console.log(`   Laba TPM (Gross): ${muatanRes.data.laba_tpm}`);

        // 3. Create Internal Workshop Repair for this Muatan
        console.log('\n--- 3. Create Internal Repair in Workshop ---');
        // Add a sparepart first if needed (assuming HPP 10k, Jual 20k)
        // For simplicity, we use dynamic jasa servis
        const bengkelRes = await axios.post(`${API_URL}/api/v1/bengkel/transaksi`, {
            tanggal: new Date().toISOString().split('T')[0],
            nama_customer: 'JASA ANGKUT UNIT',
            kategori: 'jasa_angkut',
            muatan_id: muatanId,
            armada_id: armadaId,
            detail_services: [
                { nama_jasa: 'Ganti Oli Truk', harga: 100000, qty: 1 }
            ],
            metode_bayar: 'INTERNAL',
            status_bayar: 'BELUM_LUNAS'
        });
        const bengkelNo = bengkelRes.data.nomor_transaksi;
        console.log(`✅ Workshop Transaction created: ${bengkelNo}`);

        // 4. Verification: Reports
        console.log('\n--- 4. Verification: Reports ---');
        
        // A. Jasa Angkut Summary
        const jaSummaryRes = await axios.get(`${API_URL}/api/v1/jasa-angkut/summary`);
        const jaSummary = jaSummaryRes.data;
        console.log(`✅ JA Summary:`);
        console.log(`   Total Pendapatan (TPM Share): ${jaSummary.total_pendapatan}`);
        console.log(`   Total Biaya Trip (BBM+Tol): ${jaSummary.total_biaya_trip}`);
        console.log(`   Total Biaya Bengkel: ${jaSummary.details.biaya_bengkel}`);
        console.log(`   Net Laba TPM (JA Unit): ${jaSummary.laba_tpm}`);

        // B. Neraca (Check Internal Debt/Receivable)
        const neracaRes = await axios.get(`${API_URL}/api/v1/reports/neraca?as_of=${new Date().toISOString().split('T')[0]}`);
        const neraca = neracaRes.data;
        console.log(`\n✅ Neraca (Balance Sheet):`);
        console.log(`   Piutang Jasa Angkut (Internal): ${neraca.aktiva_lancar.piutang_jasa_angkut}`);
        console.log(`   Selisih (Balanced?): ${neraca.selisih}`);
        console.log(`   Is Balanced: ${neraca.is_balanced}`);

        if (neraca.cross_validation.mismatches.length > 0) {
            console.log('⚠️ Mismatches found:');
            console.table(neraca.cross_validation.mismatches);
        } else {
            console.log('✅ No internal mismatches found.');
        }

        // C. Laba Rugi (Consolidated)
        const lrRes = await axios.get(`${API_URL}/api/v1/reports/laba-rugi?tanggal_dari=2024-01-01&tanggal_sampai=${new Date().toISOString().split('T')[0]}`);
        const lr = lrRes.data;
        console.log(`\n✅ Laba Rugi (Consolidated):`);
        console.log(`   Pendapatan JA: ${lr.pendapatan.jasa_angkut}`);
        console.log(`   Biaya Operasional JA: ${lr.pengeluaran.jasa_angkut}`);
        console.log(`   Laba Bersih Konsolidasi: ${lr.laba_bersih}`);

        console.log('\n✨ Test Completed successfully!');

    } catch (error) {
        console.error('❌ Test failed!');
        if (error.response) {
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

runTest();
