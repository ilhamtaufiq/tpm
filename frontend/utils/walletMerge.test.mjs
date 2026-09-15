// node --test frontend/utils/walletMerge.test.mjs
// Node 24 membuang tipe .ts sendiri, jadi util-nya diimpor apa adanya.
import test from 'node:test';
import assert from 'node:assert';

import {
    EXPENSE_UNITS,
    expenseUnitsParam,
    expenseToKasRow,
    filterWalletExpenseRows,
    mergeWalletRows,
} from './walletMerge.ts';

const kasRow = (over = {}) => ({
    id: 1, nomor_transaksi: 'KAS260901001', tanggal: '2026-09-14',
    jenis: 'KAS_UNIT_BENGKEL', tipe: 'KELUAR', nominal: 1000,
    sumber: 'PENGELUARAN', nomor_referensi: 'PGL2609140001',
    keterangan: 'x', created_at: '2026-09-14T02:00:00', ...over,
});

const expenseRow = (over = {}) => ({
    id: 7, nomor_transaksi: 'PGL2609140001', tanggal: '2026-09-14',
    bisnis_kategori: 'bengkel', deskripsi: 'CUTTING TIPIS', jumlah: 235000,
    created_at: '2026-09-14T03:00:00', ...over,
});

test('expense unit param: mobil gabung 3 penamaan historis', () => {
    assert.equal(expenseUnitsParam('BENGKEL'), 'bengkel');
    assert.equal(expenseUnitsParam('JUAL_BELI_MOBIL'), 'jual_beli_mobil,mobil,penjualan_mobil');
    assert.equal(expenseUnitsParam('TIDAK_DIKENAL'), '');
    assert.deepEqual(EXPENSE_UNITS.BENGKEL, ['bengkel']);
});

test('expense yang baris kasnya sudah tampil dibuang (tak dobel)', () => {
    const kas = [kasRow()];
    const kept = filterWalletExpenseRows([expenseRow()], 'BENGKEL', kas.map(r => r.nomor_referensi));
    assert.deepEqual(kept, []);
});

test('expense bayar dari akun pusat tetap muncul, unit lain dibuang', () => {
    const kept = filterWalletExpenseRows(
        [expenseRow(), expenseRow({ id: 8, bisnis_kategori: 'jasa_angkut' })],
        'BENGKEL',
        [],
    );
    assert.deepEqual(kept.map(e => e.id), [7]);
});

test('baris optimistis offline tidak bocor ke dompet', () => {
    const kept = filterWalletExpenseRows(
        [expenseRow({ nomor_transaksi: 'OFF-123456' })],
        'BENGKEL',
        [],
    );
    assert.deepEqual(kept, []);
});

test('baris kas unit mobil cocok lewat nama historis', () => {
    const kept = filterWalletExpenseRows(
        [expenseRow({ bisnis_kategori: 'penjualan_mobil' })],
        'JUAL_BELI_MOBIL',
        [],
    );
    assert.equal(kept.length, 1);
});

test('merge: dedup per id, terbaru dulu', () => {
    const rows = mergeWalletRows(
        [kasRow({ id: 1, tanggal: '2026-09-10' })],
        [kasRow({ id: 2, tanggal: '2026-09-15' }), kasRow({ id: 1 })],
        [expenseToKasRow(expenseRow())],
    );
    // expense 09-14 jatuh di antara 09-15 dan 09-10; id 1 yang muncul dua kali hanya sekali.
    assert.deepEqual(rows.map(r => r.id), [2, -7, 1]);
});

test('expenseToKasRow: id negatif, bentuk seperti baris kas', () => {
    const row = expenseToKasRow(expenseRow());
    assert.equal(row.id, -7);
    assert.equal(row.tipe, 'KELUAR');
    assert.equal(row.nominal, 235000);
    assert.equal(row.keterangan, 'CUTTING TIPIS');
});
