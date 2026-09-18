import { describe, expect, it } from 'vitest';
import { drillBedahPlug, drillModalKomposisi, drillNeracaNonKas, sumBedahPlug } from './drills';

// Math murni Drill laporan: Σ komponen = total. Tanpa framework UI.
describe('sumBedahPlug', () => {
  it('HPP − pembelian + hutang dilunasi', () => {
    expect(sumBedahPlug({
      hpp_parts_terjual: 100, hpp_mobil_terjual: 200, hpp_mobil_prep_terjual: 50,
      pembelian_part_kas: 80, pembelian_aset_kas: 10, pembelian_mobil_kas: 150,
      pembelian_hutang: 20, hutang_internal_tercatat: 5, hutang_import_dilunasi: 30,
    })).toBe(100 + 200 + 50 - 80 - 10 - 150 - 20 - 5 + 30);
  });
  it('kosong = 0', () => {
    expect(sumBedahPlug({})).toBe(0);
  });
});

describe('drillBedahPlug residual', () => {
  it('label explained bila Σ = sisaPlug', async () => {
    const spec = drillBedahPlug({ hpp_parts_terjual: 100, pembelian_part_kas: 100, sisaPlug: 0 });
    expect(spec.label).toMatch(/explained/);
  });
  it('label Δ bila belum explained', async () => {
    const spec = drillBedahPlug({ hpp_parts_terjual: 100, sisaPlug: 0 });
    expect(spec.label).toMatch(/belum explained/);
  });
});

describe('drillNeracaNonKas plug', () => {
  it('Σ rows = total (plug = total − komponen)', async () => {
    const spec = drillNeracaNonKas({ persediaan: 10, stok_mobil: 20, aset_tetap: 30, piutang_discovery: 5, hutang_import: -7, total: 100 });
    const res = await spec.fetch({ tanggal_dari: '2024-01-01', tanggal_sampai: '2024-01-31' });
    const rows = (res as { data: Array<{ amount: number }> }).data;
    expect(rows.reduce((a, r) => a + r.amount, 0)).toBe(100);
  });
});

describe('drillModalKomposisi', () => {
  const fetchRows = async (parts: Parameters<typeof drillModalKomposisi>[0]) =>
    ((await drillModalKomposisi(parts).fetch({ tanggal_dari: '2024-01-01', tanggal_sampai: '2026-09-18' })) as {
      data: Array<{ komponen: string; amount: number }>;
    }).data;

  it('baris penjelas Σ = selisih (identity − bottom-up), tanpa plug', async () => {
    // Angka nyata 2026-09-18: gap −196.219.298 ≈ −hutang_investor + hutang_internal.
    const rows = await fetchRows({
      setoran: 2_438_830_523, laba_ditahan: -1_134_767, prive: 3_202_202,
      total: 2_238_274_256, hutang_investor: 200_000_000, hutang_internal: 4_780_000,
    });
    const sum = (prefix: string) =>
      rows.filter((r) => r.komponen.startsWith(prefix)).reduce((a, r) => a + r.amount, 0);
    const gapRow = rows.find((r) => r.komponen.startsWith('—'));
    // Empat baris penjelas harus menjumlah persis ke baris selisih.
    expect(sum('    ')).toBe(gapRow?.amount);
    // Baris hutang investor sudah ditandai negatif (identity memasukkannya).
    expect(rows.find((r) => r.komponen.includes('Hutang Investor'))?.amount).toBe(-200_000_000);
  });

  it('residual tak terjelaskan tampil apa adanya, tidak dinolkan', async () => {
    const rows = await fetchRows({
      setoran: 100, laba_ditahan: 0, prive: 0, total: 250, hutang_investor: 100,
    });
    // gap = 250 − 100 = 150; explained = −100 → unexplained = 250.
    expect(rows.find((r) => r.komponen.includes('Tak terjelaskan'))?.amount).toBe(250);
  });

  it('tanpa data penjelas, seluruh selisih jadi tak terjelaskan', async () => {
    const rows = await fetchRows({ setoran: 0, laba_ditahan: 0, prive: 0, total: 500 });
    expect(rows.find((r) => r.komponen.includes('Tak terjelaskan'))?.amount).toBe(500);
  });
});
