import { drillService, reportService, stockService } from '../api/services';
import type { PeriodParams } from '../api/services';
import { formatCurrency } from '../utils/format';
import type { NeracaReport } from '../types/reports';
import type { DrillSpec } from './reports';

const rp = (key: string) => ({
  key,
  header: 'Nominal',
  align: 'right' as const,
  render: (r: Record<string, unknown>) => formatCurrency(r[key]),
});

const tgl = (key = 'tanggal') => ({
  key,
  header: 'Tanggal',
  render: (r: Record<string, unknown>) => String(r[key] ?? '-').slice(0, 10),
});

export const drillSetoranKas = (): DrillSpec => ({
  key: 'setoran-kas',
  label: 'Rincian setoran modal kas',
  columns: [
    tgl(),
    { key: 'nomor_transaksi', header: 'Referensi' },
    { key: 'keterangan', header: 'Keterangan' },
    rp('nominal'),
  ],
  fetch: (p: PeriodParams) => drillService.kasMasukModal(p),
});

export const drillKasJenis = (jenis: string, label: string): DrillSpec => ({
  key: `kas-${jenis}`,
  label: `Rincian mutasi ${label}`,
  columns: [
    tgl(),
    { key: 'nomor_transaksi', header: 'Referensi' },
    { key: 'tipe', header: 'Tipe' },
    { key: 'keterangan', header: 'Keterangan' },
    { key: 'signed', header: 'Nominal', align: 'right', render: (r) => formatCurrency(r.signed ?? r.nominal) },
  ],
  fetch: async (p: PeriodParams) => {
    const res = await drillService.kasJenis(jenis, p);
    return {
      ...res,
      data: res.data.map((r) => ({
        ...r,
        signed: r.tipe === 'KELUAR' ? -Number(r.nominal ?? 0) : Number(r.nominal ?? 0),
      })),
    };
  },
});

export const drillBengkelSales = (): DrillSpec => ({
  key: 'bengkel-sales',
  label: 'Rincian transaksi bengkel',
  columns: [
    tgl(),
    { key: 'nomor_transaksi', header: 'Nomor' },
    { key: 'nama_customer', header: 'Customer' },
    { key: 'nomor_plat', header: 'Plat' },
    { key: 'status_bayar', header: 'Bayar' },
    rp('total_parts'),
    rp('total_jasa'),
    rp('diskon'),
    rp('grand_total'),
    rp('hpp_parts'),
  ],
  fetch: (p: PeriodParams) => drillService.bengkel(p),
});

// Perbaikan bengkel untuk unit TERJUAL periode ini (komponen workshop_bills
// dari HPP mobil — selaras total_biaya_bengkel_sold laporan, bukan omzet servis).
// Ledger "Perawatan Bengkel" (MobilBiayaLainnya) tak ada endpoint list,
// jadi Σ drill ≈ workshop_bills; selisih vs angka laporan = komponen ledger.
const INTERNAL_MOBIL_KATEGORI = new Set(['jual_beli_mobil', 'mobil', 'penjualan_mobil']);

export const drillRepairMobil = (): DrillSpec => ({
  key: 'repair-mobil',
  label: 'Rincian perbaikan bengkel unit terjual',
  columns: [
    tgl(),
    { key: 'nomor_transaksi', header: 'Nomor' },
    { key: 'nomor_plat', header: 'Plat' },
    { key: 'kategori', header: 'Kategori' },
    rp('grand_total'),
  ],
  fetch: async (p: PeriodParams) => {
    const [jual, bengkel] = await Promise.all([
      drillService.penjualanMobil(p),
      drillService.bengkel(p),
    ]);
    const soldIds = new Set((jual.data ?? []).map((r) => Number(r.mobil_id ?? -1)));
    const rows = (bengkel.data ?? []).filter(
      (r) =>
        r.mobil_id != null &&
        soldIds.has(Number(r.mobil_id)) &&
        INTERNAL_MOBIL_KATEGORI.has(String(r.kategori ?? '').toLowerCase()),
    );
    return { data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 };
  },
});

export const drillPengeluaran = (): DrillSpec => ({
  key: 'pengeluaran',
  label: 'Rincian pengeluaran',
  columns: [
    tgl(),
    { key: 'nomor_transaksi', header: 'Nomor' },
    { key: 'kategori', header: 'Kategori' },
    { key: 'bisnis_kategori', header: 'Unit' },
    { key: 'deskripsi', header: 'Deskripsi' },
    rp('jumlah'),
  ],
  fetch: (p: PeriodParams) => drillService.pengeluaran(p),
});

export const drillPenjualanMobil = (): DrillSpec => ({
  key: 'penjualan-mobil',
  label: 'Rincian penjualan mobil',
  columns: [
    tgl(),
    { key: 'nomor_transaksi', header: 'Nomor' },
    { key: 'mobil_info', header: 'Unit' },
    { key: 'nama_pembeli', header: 'Pembeli' },
    { key: 'status_bayar', header: 'Bayar' },
    rp('harga_jual'),
  ],
  fetch: async (p: PeriodParams) => {
    const res = await drillService.penjualanMobil(p);
    return {
      ...res,
      data: res.data.map((r) => {
        const m = (r.mobil ?? {}) as Record<string, unknown>;
        const unit = [m.merek, m.model].filter(Boolean).join(' ');
        return {
          ...r,
          mobil_info: unit + (m.nomor_plat ? ` (${m.nomor_plat})` : '') || '-',
          harga_beli: Number(m.harga_beli ?? 0),
        };
      }),
    };
  },
});

export const drillMobilMasuk = (): DrillSpec => ({
  key: 'mobil-masuk',
  label: 'Rincian unit masuk',
  columns: [
    { key: 'tanggal_masuk', header: 'Masuk', render: (r) => String(r.tanggal_masuk ?? '-').slice(0, 10) },
    { key: 'nomor_plat', header: 'Plat' },
    { key: 'merek', header: 'Merek' },
    { key: 'model', header: 'Model' },
    rp('harga_beli'),
  ],
  fetch: (p: PeriodParams) => drillService.mobilMasuk(p),
});

// Stok unsold: unit masuk minus yang sudah TERJUAL. Selaras stok_mobil laporan.
// amountKey 'nilai_total' (= harga_beli + total_biaya) agar Σ = angka laporan;
// 'harga_beli' saja undercount karena stok dinilai full inventory cost.
export const drillStokMobil = (): DrillSpec => ({
  key: 'stok-mobil',
  label: 'Rincian stok mobil',
  columns: [
    { key: 'tanggal_masuk', header: 'Masuk', render: (r) => String(r.tanggal_masuk ?? '-').slice(0, 10) },
    { key: 'nomor_plat', header: 'Plat' },
    { key: 'merek', header: 'Merek' },
    { key: 'model', header: 'Model' },
    rp('harga_beli'),
    { key: 'total_biaya', header: 'Biaya', align: 'right' as const, render: (r) => formatCurrency(r.total_biaya) },
    { key: 'nilai_total', header: 'Nilai', align: 'right' as const, render: (r) => formatCurrency(r.nilai_total) },
  ],
  fetch: async (p: PeriodParams) => {
    const res = await drillService.mobilMasuk(p);
    const rows = res.data
      .filter((r) => String(r.status ?? '').toUpperCase() !== 'TERJUAL')
      .map((r) => ({
        ...r,
        nilai_total: Number(r.harga_beli ?? 0) + Number(r.total_biaya ?? 0),
      }));
    return { ...res, data: rows };
  },
});

export const drillMuatan = (): DrillSpec => ({
  key: 'muatan',
  label: 'Rincian muatan',
  columns: [
    tgl(),
    { key: 'nomor_transaksi', header: 'Nomor' },
    { key: 'tujuan', header: 'Tujuan' },
    { key: 'supir_nama', header: 'Supir' },
    { key: 'status_bayar', header: 'Bayar' },
    rp('pendapatan_kotor'),
  ],
  fetch: (p: PeriodParams) => drillService.muatan(p),
});

const piutangCols = [
  tgl(),
  { key: 'nomor_piutang', header: 'Nomor' },
  { key: 'nama_debitur', header: 'Debitur' },
  { key: 'sumber', header: 'Sumber' },
  { key: 'status', header: 'Status' },
  rp('sisa_piutang'),
];

const hutangCols = [
  tgl(),
  { key: 'nomor_hutang', header: 'Nomor' },
  { key: 'nama_kreditur', header: 'Kreditur' },
  { key: 'sumber', header: 'Sumber' },
  { key: 'status', header: 'Status' },
  rp('sisa_hutang'),
];

export const drillPiutang = (sumber?: string, label = 'Rincian piutang'): DrillSpec => ({
  key: `piutang${sumber ? `-${sumber}` : ''}`,
  label,
  columns: piutangCols,
  fetch: (p: PeriodParams) => drillService.piutangFiltered(p, sumber),
});

export const drillHutang = (sumber?: string, label = 'Rincian hutang'): DrillSpec => ({
  key: `hutang${sumber ? `-${sumber}` : ''}`,
  label,
  columns: hutangCols,
  fetch: (p: PeriodParams) => drillService.hutangFiltered(p, sumber),
});

// Hutang LAINNYA murni: sumber LAINNYA yang unit-nya tak terpetakan ke unit
// operasional (BENGKEL/JASA_ANGKUT/JUAL_BELI_MOBIL). Selaras hutang_lainnya laporan.
const UNIT_ROUTED = new Set(['BENGKEL', 'JASA_ANGKUT', 'JUAL_BELI_MOBIL']);

export const drillHutangLainnya = (label = 'Rincian hutang lainnya'): DrillSpec => ({
  key: 'hutang-lainnya-murni',
  label,
  columns: hutangCols,
  fetch: async (p: PeriodParams) => {
    const res = await drillService.hutangFiltered(p, 'LAINNYA');
    return {
      ...res,
      data: res.data.filter((r) => !UNIT_ROUTED.has(String(r.unit ?? '').toUpperCase())),
    };
  },
});

// Hutang unit operasional: gabungan sumber pembelian + LAINNYA unit tsb.
// Selaras get_debt_balance_by_unit laporan (base.py).
export const drillHutangUnit = (unit: string, sources: string[], label: string): DrillSpec => ({
  key: `hutang-unit-${unit}`,
  label,
  columns: hutangCols,
  fetch: async (p: PeriodParams) => {
    const res = await Promise.all(sources.map((s) => drillService.hutangFiltered(p, s)));
    const rows = res
      .flatMap((r) => r.data ?? [])
      .filter((r) =>
        String(r.sumber ?? '').toUpperCase() === 'LAINNYA'
          ? String(r.unit ?? '').toUpperCase() === unit.toUpperCase()
          : true,
      );
    return { data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 };
  },
});

export const drillInvestor = (): DrillSpec => ({
  key: 'investor-history',
  label: 'Rincian pencairan investor',
  columns: [
    tgl(),
    { key: 'transaksi', header: 'Transaksi', render: (r) => String((r.transaksi as Record<string, unknown> | undefined)?.nomor_transaksi ?? r.transaksi_id ?? '-') },
    { key: 'metode_bayar', header: 'Metode' },
    rp('nominal'),
  ],
  fetch: (p: PeriodParams) => drillService.investorHistory(p),
});

export const drillInvestorSaldo = (): DrillSpec => ({
  key: 'investor-saldo',
  label: 'Rincian saldo hutang investor',
  columns: [
    { key: 'unit', header: 'Unit' },
    { key: 'nama_investor', header: 'Investor' },
    { key: 'status', header: 'Status' },
    rp('modal'),
    rp('laba'),
    rp('total'),
  ],
  // Komposisi SALDO (selaras hutang_investor laporan): unit belum terjual
  // (modal) + unit terjual belum cair (modal + laba) + hutang investor
  // saldo awal impor (IMP-*, unit=MODAL).
  fetch: async () => {
    const [units, pending, hutang] = await Promise.all([
      stockService.mobilList({ tipe_kepemilikan: 'INVESTOR', limit: 100 }),
      drillService.investorPending(),
      drillService.hutangFiltered({ tanggal_dari: '2024-01-01', tanggal_sampai: '2099-12-31' }),
    ]);
    const list = ((units as { data?: Record<string, unknown>[] } | undefined)?.data ?? []);
    const rows: Record<string, unknown>[] = list
      .filter((u: Record<string, unknown>) => String(u.status ?? '').toUpperCase() !== 'TERJUAL')
      .map((u: Record<string, unknown>) => {
        const unit = [u.merek, u.model].filter(Boolean).join(' ');
        return {
          unit: unit + (u.nomor_plat ? ` (${u.nomor_plat})` : ''),
          nama_investor: u.nama_investor,
          status: u.status,
          modal: Number(u.nominal_investor ?? 0),
          laba: 0,
          total: Number(u.nominal_investor ?? 0),
        };
      });
    for (const t of pending ?? []) {
      rows.push({
        unit: t.mobil,
        nama_investor: t.nama_investor,
        status: 'TERJUAL-BELUM_CAIR',
        modal: Number(t.nominal_investor ?? 0),
        laba: Number(t.laba_investor ?? 0),
        total: Number(t.total_pencairan ?? 0),
      });
    }
    for (const h of ((hutang as { data?: Record<string, unknown>[] } | undefined)?.data ?? [])) {
      if (!String(h.nomor_referensi ?? '').startsWith('IMP-') || h.unit !== 'MODAL') continue;
      rows.push({
        unit: 'Saldo Awal (Impor)',
        nama_investor: h.nama_kreditur,
        status: 'SALDO_AWAL',
        modal: 0,
        laba: 0,
        total: Number(h.sisa_hutang ?? 0),
      });
    }
    return { data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 };
  },
});

export const drillPembelianPart = (): DrillSpec => ({
  key: 'pembelian-part',
  label: 'Rincian pembelian sparepart',
  columns: [
    tgl(),
    { key: 'nomor_transaksi', header: 'Nomor' },
    { key: 'supplier_nama', header: 'Supplier' },
    { key: 'status_bayar', header: 'Bayar' },
    rp('grand_total'),
  ],
  fetch: (p: PeriodParams) => drillService.pembelianPart(p),
});

// Stok sparepart per item (snapshot — nilai = stok × harga_beli, selaras persediaan laporan).
export const drillStokSparepart = (): DrillSpec => ({
  key: 'stok-sparepart',
  label: 'Rincian stok sparepart',
  columns: [
    { key: 'kode', header: 'Kode' },
    { key: 'nama', header: 'Nama' },
    { key: 'stok', header: 'Stok', align: 'right' as const, render: (r) => String(r.stok ?? '-') },
    { key: 'harga_beli', header: 'Harga Beli', align: 'right' as const, render: (r) => formatCurrency(r.harga_beli) },
    { key: 'nilai', header: 'Nilai', align: 'right' as const, render: (r) => formatCurrency(r.nilai) },
  ],
  fetch: async () => {
    const res = await stockService.list({ limit: 5000, sort_by: 'nama', sort_order: 'asc' });
    const list = ((res as { data?: Record<string, unknown>[] } | undefined)?.data ?? []) as Record<string, unknown>[];
    const rows = list
      .filter((r) => Number(r.stok ?? 0) !== 999999)
      .map((r) => ({ ...r, nilai: Number(r.stok ?? 0) * Number(r.harga_beli ?? 0) }))
      .filter((r) => Number(r.nilai ?? 0) !== 0);
    return { data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 };
  },
});

// Gaji pokok per slip (status LUNAS, tanggal_bayar dalam periode).
export const drillGaji = (): DrillSpec => ({
  key: 'gaji',
  label: 'Rincian slip gaji',
  columns: [
    { key: 'tanggal_bayar', header: 'Dibayar', render: (r) => String(r.tanggal_bayar ?? '-').slice(0, 10) },
    { key: 'nomor_slip', header: 'Slip' },
    { key: 'karyawan_nama', header: 'Karyawan' },
    rp('gaji_pokok'),
  ],
  fetch: (p: PeriodParams) => drillService.slipGajiRange(p),
});

// Uang lembur per slip.
export const drillLembur = (): DrillSpec => ({
  key: 'lembur',
  label: 'Rincian lembur',
  columns: [
    { key: 'tanggal_bayar', header: 'Dibayar', render: (r) => String(r.tanggal_bayar ?? '-').slice(0, 10) },
    { key: 'nomor_slip', header: 'Slip' },
    { key: 'karyawan_nama', header: 'Karyawan' },
    rp('uang_lembur'),
  ],
  fetch: (p: PeriodParams) => drillService.slipGajiRange(p),
});

// Pengeluaran ledger per unit bisnis (bisnis_kategori backend).
// `unit` boleh satu kategori atau gabungan — laporan menggabungkan beberapa
// kategori untuk satu baris (mis. overhead mobil = mobil + jual_beli_mobil +
// penjualan_mobil di base.py), jadi drill harus menjaring daftar yang sama.
export const drillPengeluaranUnit = (unit: string | string[], label: string): DrillSpec => {
  const units = Array.isArray(unit) ? unit : [unit];
  return {
    key: `pengeluaran-${units.join('+')}`,
    label: `Rincian ${label}`,
    columns: [
      tgl(),
      { key: 'nomor_transaksi', header: 'Nomor' },
      ...(units.length > 1 ? [{ key: 'bisnis_kategori', header: 'Unit' }] : []),
      { key: 'kategori', header: 'Kategori' },
      { key: 'deskripsi', header: 'Deskripsi' },
      rp('jumlah'),
    ],
    fetch: async (p: PeriodParams) => {
      const pages = await Promise.all(
        units.map((u) =>
          drillService
            .pengeluaranUnit(u, p)
            .catch(() => ({ data: [] as Record<string, unknown>[], total: 0, page: 1, size: 0, pages: 0 })),
        ),
      );
      const rows = pages
        .flatMap((r) => r.data ?? [])
        .sort((a, b) => String(a.tanggal ?? '').localeCompare(String(b.tanggal ?? '')));
      return { data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 };
    },
  };
};

// Beban Umum mobil: ledger per unit + baris penyesuaian agar Σ = angka laporan.
// Ledger mentah saja TIDAK rekonsiliasi: pengeluaran yang punya mobil_id sudah
// di-tag ke unit dan dikurangkan dari overhead (base.py:291), dan prive unit
// bukan beban. Baris penyesuaian dari `beban_umum_komponen` menutup selisihnya.
export const drillBebanUmumMobil = (parts?: {
  total_unit_expenses?: number;
  tagged_ke_mobil?: number;
  prive?: number;
  post_sale?: number;
}): DrillSpec => {
  const n = (v: unknown) => Number(v ?? 0) || 0;
  const UNITS = ['mobil', 'jual_beli_mobil', 'penjualan_mobil'];
  const unitLabel = (u: string) =>
    u === 'penjualan_mobil' ? 'Mobil (Umum)' : u === 'jual_beli_mobil' ? 'Mobil (Persiapan)' : 'Mobil (Unit)';
  return {
    key: 'beban-umum-mobil',
    label: 'Rincian beban umum mobil',
    columns: [
      { key: 'unit', header: 'Unit' },
      { key: 'keterangan', header: 'Keterangan' },
      rp('amount'),
    ],
    fetch: async (p: PeriodParams) => {
      const pages = await Promise.all(
        UNITS.map((u) =>
          drillService
            .pengeluaranUnit(u, p)
            .catch(() => ({ data: [] as Record<string, unknown>[], total: 0, page: 1, size: 0, pages: 0 })),
        ),
      );
      const rows: Record<string, unknown>[] = pages.flatMap((r, i) =>
        (r.data ?? []).map((x) => ({
          unit: unitLabel(UNITS[i]),
          keterangan: String(x.deskripsi ?? x.kategori ?? '-'),
          amount: n(x.jumlah),
          tanggal: x.tanggal,
        })),
      );
      const adj: Array<[string, number]> = [
        ['Dikurangi: sudah ter-tag ke unit mobil', -n(parts?.tagged_ke_mobil)],
        ['Dikurangi: pengeluaran prive unit (bukan beban)', -n(parts?.prive)],
        ['Ditambah: biaya pasca-penjualan', n(parts?.post_sale)],
      ];
      for (const [keterangan, amount] of adj) {
        if (amount !== 0) rows.push({ unit: 'Penyesuaian', keterangan, amount });
      }
      rows.sort((a, b) => String(a.tanggal ?? '').localeCompare(String(b.tanggal ?? '')));
      return { data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 };
    },
  };
};

// Prive = max(ledger kategori PRIVE, kas keterangan Prive/Pencairan/pembagian laba).
export const drillPrive = (): DrillSpec => ({
  key: 'prive',
  label: 'Rincian prive pemilik',
  columns: [
    tgl(),
    { key: 'nomor_transaksi', header: 'Referensi' },
    { key: 'keterangan', header: 'Keterangan' },
    rp('nominal'),
  ],
  fetch: async (p: PeriodParams) => {
    const [ledger, kas] = await Promise.all([
      drillService.pengeluaranUnit('', p).catch(() => ({ data: [] as Record<string, unknown>[] })),
      drillService.kasSumber('PRIVE', 'KELUAR', p),
    ]);
    const rows = [
      ...(ledger.data ?? []).filter((r) => String(r.kategori ?? '').toUpperCase() === 'PRIVE'),
      ...(kas.data ?? []),
    ];
    return { data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 };
  },
});

// Kasbon karyawan outstanding per sumber.
export const drillKasbon = (): DrillSpec => ({
  key: 'kasbon',
  label: 'Rincian kasbon karyawan',
  columns: [
    tgl(),
    { key: 'nomor_kasbon', header: 'Nomor' },
    { key: 'karyawan_nama', header: 'Karyawan' },
    { key: 'status', header: 'Status' },
    { key: 'sisa', header: 'Sisa', align: 'right' as const, render: (r) => formatCurrency(Number(r.nominal ?? 0) - Number(r.jumlah_bayar ?? 0)) },
  ],
  fetch: (p: PeriodParams) => drillService.kasbon(p),
});

// Revaluasi harga beli: memo = kumulatif amount kotor (released info saja).
export const drillRevaluasi = (): DrillSpec => ({
  key: 'revaluasi',
  label: 'Rincian revaluasi harga beli',
  columns: [
    tgl(),
    { key: 'spare_part_nama', header: 'Sparepart' },
    { key: 'qty_at_reval', header: 'Qty', align: 'right' as const, render: (r) => String(r.qty_at_reval ?? '-') },
    { key: 'harga_lama', header: 'Lama', align: 'right' as const, render: (r) => formatCurrency(r.harga_lama) },
    { key: 'harga_baru', header: 'Baru', align: 'right' as const, render: (r) => formatCurrency(r.harga_baru) },
    rp('amount'),
    { key: 'released', header: 'Released', align: 'right' as const, render: (r) => formatCurrency(r.released) },
  ],
  fetch: (p: PeriodParams) => drillService.revaluasi(p),
});

// Aset tetap aktif (snapshot — tanpa filter periode).
export const drillAset = (): DrillSpec => ({
  key: 'aset',
  label: 'Rincian aset tetap',
  columns: [
    { key: 'kode', header: 'Kode' },
    { key: 'nama', header: 'Nama' },
    rp('harga_beli'),
  ],
  fetch: () => drillService.aset(),
});

// Penyesuaian (modal_non_kas): komponen SETORAN dari respons laporan — tanpa fetch.
// total = setoran_mobil + setoran_piutang − setoran_hutang + setoran_aset.
export const drillModalNonKas = (parts: { setoran_mobil?: number; setoran_piutang?: number; setoran_hutang?: number; setoran_aset?: number }): DrillSpec => {
  const rows = [
    { komponen: 'Setoran mobil (non-kas)', amount: Number(parts.setoran_mobil ?? 0) },
    { komponen: 'Piutang saldo awal (impor)', amount: Number(parts.setoran_piutang ?? 0) },
    { komponen: 'Hutang saldo awal (impor, pengurang)', amount: -Number(parts.setoran_hutang ?? 0) },
    { komponen: 'Setoran aset tetap', amount: Number(parts.setoran_aset ?? 0) },
  ].filter((r) => r.amount !== 0);
  return {
    key: 'penyesuaian',
    label: 'Rincian penyesuaian',
    columns: [
      { key: 'komponen', header: 'Komponen' },
      rp('amount'),
    ],
    fetch: async () => ({ data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 }),
  };
};

// Bedah selisih penyeimbang: memo barang modal yang sudah terjual (terkubur
// di kas/piutang/laba) + pembelian tercatat. Bukan baris aditif — hideDiff,
// karena total selisih sendiri sudah dijelaskan drill di atas.
// Σ komponen bedah selisih — dipakai label residual otomatis.
export const sumBedahPlug = (d: {
  hpp_parts_terjual?: number; hpp_mobil_terjual?: number; hpp_mobil_prep_terjual?: number;
  pembelian_part_kas?: number; pembelian_aset_kas?: number; pembelian_mobil_kas?: number;
  pembelian_hutang?: number; hutang_internal_tercatat?: number;
  hutang_import_dilunasi?: number;
}): number => {
  const n = (v: number | undefined) => Number(v ?? 0);
  return n(d.hpp_parts_terjual) + n(d.hpp_mobil_terjual) + n(d.hpp_mobil_prep_terjual)
    - n(d.pembelian_part_kas) - n(d.pembelian_aset_kas) - n(d.pembelian_mobil_kas)
    - n(d.pembelian_hutang) - n(d.hutang_internal_tercatat) + n(d.hutang_import_dilunasi);
};

export const drillBedahPlug = (d: {
  hpp_parts_terjual?: number; hpp_mobil_terjual?: number; hpp_mobil_prep_terjual?: number;
  pembelian_part_kas?: number; pembelian_aset_kas?: number; pembelian_mobil_kas?: number;
  pembelian_hutang?: number; hutang_internal_tercatat?: number;
  hutang_import_dilunasi?: number;
  sisaPlug?: number;
}): DrillSpec => {
  const n = (v: number | undefined) => Number(v ?? 0);
  const rows = [
    { komponen: 'HPP part terjual (modal yg sudah laku)', amount: n(d.hpp_parts_terjual) },
    { komponen: 'HPP mobil terjual (harga beli unit laku)', amount: n(d.hpp_mobil_terjual) },
    { komponen: 'Prep mobil terjual (bagian HPP)', amount: n(d.hpp_mobil_prep_terjual) },
    { komponen: 'Pembelian part tercatat (pengurang)', amount: -n(d.pembelian_part_kas) },
    { komponen: 'Pembelian aset tercatat (pengurang)', amount: -n(d.pembelian_aset_kas) },
    { komponen: 'Pembelian mobil tercatat (pengurang)', amount: -n(d.pembelian_mobil_kas) },
    { komponen: 'Pembelian via hutang tercatat (pengurang)', amount: -n(d.pembelian_hutang) },
    { komponen: 'Hutang internal tercatat (pengurang)', amount: -n(d.hutang_internal_tercatat) },
    { komponen: 'Hutang IMP dilunasi (nominal − sisa)', amount: n(d.hutang_import_dilunasi) },
  ].filter((r) => r.amount !== 0);
  // Residual = Σ bedah − selisih. |residual| < 100 → explained penuh (✓).
  const residual = d.sisaPlug === undefined ? undefined : sumBedahPlug(d) - Number(d.sisaPlug);
  const label = residual === undefined
    ? 'Bedah selisih (memo)'
    : Math.abs(residual) < 100
      ? `Bedah selisih ✓ explained (${formatCurrency(residual)})`
      : `Bedah selisih Δ ${formatCurrency(residual)} belum explained`;
  return {
    key: 'bedah-plug',
    label,
    columns: [
      { key: 'komponen', header: 'Komponen' },
      rp('amount'),
    ],
    fetch: async () => ({ data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 }),
  };
};

// Gap piutang vs hutang internal per referensi (dari cross_validation backend).
// Memo — internal dikonsolidasi keluar, tapi gap tak berpasangan menekan selisih.
export const drillMismatchInternal = (mismatches: Array<{ ref: string; piutang: number; hutang: number; gap: number }>): DrillSpec => {
  const rows = (mismatches ?? []).map((mm) => ({
    ref: String(mm.ref ?? '-'),
    piutang: Number(mm.piutang ?? 0),
    hutang: Number(mm.hutang ?? 0),
    gap: Number(mm.gap ?? 0),
  }));
  return {
    key: 'mismatch-internal',
    label: `Gap internal (${rows.length})`,
    columns: [
      { key: 'ref', header: 'Referensi' },
      rp('piutang'),
      rp('hutang'),
      rp('gap'),
    ],
    fetch: async () => ({ data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 }),
  };
};

// Komposisi Modal Awal: snapshot Aktiva − Hutang pada tanggal anchor backend.
// Backend pakai `neraca(anchor).modal.total_modal`, dan Neraca menghitungnya
// sebagai total_aktiva − total_hutang — hutang investor TERMASUK (dana investor
// = kewajiban pihak ketiga, bukan modal). Jangan dikecualikan: menguranginya
// bikin total meleset sebesar hutang_investor.
// `asOf` WAJIB dari `report.modal_awal_as_of` — backend meng-anchor ke tanggal
// saldo awal impor, bukan `tanggal_dari - 1`, jadi memakai H−1 bikin komponen
// tidak menjumlah ke modal_awal.
export const drillModalAwal = (asOf: string, penyesuaian = 0): DrillSpec => {
  return {
  key: `modal-awal-${asOf}-${penyesuaian}`,
  label: 'Rincian modal awal (Aktiva − Hutang)',
  columns: [
    { key: 'komponen', header: 'Komponen' },
    rp('amount'),
  ],
  fetch: async () => {
    const r = (await reportService.neraca(asOf)) as unknown as NeracaReport;
    const al = r.aktiva_lancar;
    const rows = [
      { komponen: 'Kas & Bank', amount: Number(al.total_kas_bank ?? 0) },
      { komponen: 'Piutang', amount: Number(al.total_piutang ?? 0) },
      { komponen: 'Persediaan Sparepart', amount: Number(al.persediaan_sparepart ?? 0) },
      { komponen: 'Stok Mobil', amount: Number(al.stok_mobil ?? 0) },
      { komponen: 'Aktiva Tetap', amount: Number(r.aktiva_tetap?.total_aktiva_tetap ?? 0) },
      { komponen: 'Hutang (pengurang)', amount: -Number(r.hutang?.total_hutang ?? 0) },
      // neraca(asOf) inklusif: aktivitas non-impor hari anchor ikut terbaca di
      // sini, padahal sudah dikeluarkan dari modal_awal & tampil sebagai mutasi.
      { komponen: 'Mutasi hari saldo awal (dipindah ke arus)', amount: -Number(penyesuaian ?? 0) },
    ].filter((x) => x.amount !== 0);
    return { data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 };
  },
  };
};

// Laba/Rugi Periode per unit bisnis (Modal).
// Rumusnya HARUS sama dengan modal_service.py:176-179, dibaca dari `info.units`
// (bukan `info.laba_bengkel` yang berisi LABA KOTOR TPM — beda konsep). Diverifikasi
// Σ ketiga unit = info.laba_bersih, BEDA 0.
export const drillLabaPeriode = (units?: Record<string, Record<string, number>>): DrillSpec => {
  const n = (v: unknown) => Number(v ?? 0) || 0;
  const b = units?.bengkel ?? {};
  const m = units?.mobil ?? {};
  const ja = units?.jasa_angkut ?? {};
  const rows = [
    { unit: 'Bengkel', amount: n(b.laba_kotor) - n(b.total_expenses) - n(b.common_expenses) },
    { unit: 'Mobil', amount: n(m.total_laba_kotor) - n(m.overhead) },
    {
      unit: 'Jasa Angkut',
      amount: n(ja.revenue_tpm) - n(ja.trip_costs) - n(ja.repairs) - n(ja.overhead) - n(ja.armada_ops) - n(ja.armada_ops_ledger),
    },
  ].filter((r) => r.amount !== 0);
  return {
    key: 'laba-periode-unit',
    label: 'Rincian laba/rugi per unit',
    columns: [
      { key: 'unit', header: 'Unit Bisnis' },
      rp('amount'),
    ],
    fetch: async () => ({ data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 }),
  };
};

// Komposisi Modal Neraca: satu baris "Modal" di laporan, drill buka rinciannya.
// Baris laporan = `total_modal` = identity (aktiva − hutang), sedangkan
// setoran_modal/laba_ditahan/prive adalah hitungan bottom-up (`modal_komponen`)
// yang belum men-net hutang investor. Karena itu selisihnya dipaparkan sebagai
// baris penutup, bukan disembunyikan — Δ-nya persis hutang investor.
export const drillModalKomposisi = (parts: {
  setoran?: number;
  laba_ditahan?: number;
  prive?: number;
  total?: number;
}): DrillSpec => {
  const n = (v: number | undefined) => Number(v ?? 0);
  const bottomUp = n(parts.setoran) + n(parts.laba_ditahan) - n(parts.prive);
  const gap = n(parts.total) - bottomUp;
  const rows = [
    { komponen: 'Setoran Modal', amount: n(parts.setoran) },
    { komponen: 'Laba Ditahan', amount: n(parts.laba_ditahan) },
    { komponen: 'Prive (Pengambilan Pemilik)', amount: -n(parts.prive) },
    { komponen: 'Selisih bottom-up vs Aktiva−Hutang (hutang investor)', amount: gap },
  ].filter((r) => r.amount !== 0);
  return {
    key: 'modal-komposisi',
    label: 'Rincian modal',
    columns: [
      { key: 'komponen', header: 'Komponen' },
      rp('amount'),
    ],
    fetch: async () => ({ data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 }),
  };
};

// PENAMBAHAN MODAL (Perubahan Modal): kas + non-kas + dana investor.
export const drillPenambahanModal = (parts: { kas?: number; non_kas?: number; investor?: number }): DrillSpec => {
  const n = (v: number | undefined) => Number(v ?? 0);
  const rows = [
    { komponen: 'Setoran Modal Kas', amount: n(parts.kas) },
    { komponen: 'Modal Non-Kas (aset/piutang − hutang awal)', amount: n(parts.non_kas) },
    { komponen: 'Dana Investor Mobil', amount: n(parts.investor) },
  ].filter((r) => r.amount !== 0);
  return {
    key: 'penambahan-modal',
    label: 'Rincian penambahan modal',
    columns: [
      { key: 'komponen', header: 'Komponen' },
      rp('amount'),
    ],
    fetch: async () => ({ data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 }),
  };
};

// Komposisi Modal Non-Kas Neraca: komponen aditif + selisih penyeimbang.
// total = setoran_modal − setoran_modal_kas (balancing figure). discovery_info
// backend adalah memo cek-silang, bukan baris aditif — tampilkan sebagai
// FinancialRow memo di Reports.tsx, bukan di sini (Drill Σ harus = total).
export const drillNeracaNonKas = (parts: { persediaan?: number; stok_mobil?: number; aset_tetap?: number; piutang_discovery?: number; hutang_import?: number; total?: number }): DrillSpec => {
  const p = Number(parts.persediaan ?? 0);
  const s = Number(parts.stok_mobil ?? 0);
  const a = Number(parts.aset_tetap ?? 0);
  const pd = Number(parts.piutang_discovery ?? 0);
  const hi = Number(parts.hutang_import ?? 0);
  const t = Number(parts.total ?? 0);
  const plug = t - p - s - a - pd - hi;
  const rows = [
    { komponen: 'Persediaan Sparepart', amount: p },
    { komponen: 'Stok Mobil (Inventory)', amount: s },
    { komponen: 'Aset Tetap', amount: a },
    { komponen: 'Piutang saldo awal (IMP, tanpa KasBank)', amount: pd },
    { komponen: 'Hutang saldo awal + investor (pengurang)', amount: hi },
    // Sisa = HPP barang modal yg sudah laku − pembelian tercatat (+ hutang
  // investor). Negatif wajar bila pembelian tercatat (mis. mobil masih di
  // stok) lebih besar dari HPP yg sudah terjual — rinciannya di Bedah Plug,
  // bukan error. Selisih akuntansi nyata tampil di Validasi Komponen Modal.
    { komponen: Math.abs(plug) < 100 ? 'Selisih pembulatan' : 'Sisa penyesuaian (rincian di Bedah Plug)', amount: plug },
  ].filter((r) => r.amount !== 0);
  return {
    key: 'modal-non-kas',
    label: 'Rincian modal non-kas',
    columns: [
      { key: 'komponen', header: 'Komponen' },
      rp('amount'),
    ],
    fetch: async () => ({ data: rows, total: rows.length, page: 1, size: rows.length, pages: 1 }),
  };
};
