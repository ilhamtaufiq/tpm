import { describe, expect, it } from 'vitest';
import { drillBedahPlug, drillNeracaNonKas, sumBedahPlug } from './drills';

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
