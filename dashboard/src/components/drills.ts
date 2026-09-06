import { drillService, stockService } from '../api/services';
import type { PeriodParams } from '../api/services';
import { formatCurrency } from '../utils/format';
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
    rp('grand_total'),
  ],
  fetch: (p: PeriodParams) => drillService.bengkel(p),
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
export const drillStokMobil = (): DrillSpec => ({
  key: 'stok-mobil',
  label: 'Rincian stok mobil',
  columns: [
    { key: 'tanggal_masuk', header: 'Masuk', render: (r) => String(r.tanggal_masuk ?? '-').slice(0, 10) },
    { key: 'nomor_plat', header: 'Plat' },
    { key: 'merek', header: 'Merek' },
    { key: 'model', header: 'Model' },
    rp('harga_beli'),
  ],
  fetch: async (p: PeriodParams) => {
    const res = await drillService.mobilMasuk(p);
    return {
      ...res,
      data: res.data.filter((r) => String(r.status ?? '').toUpperCase() !== 'TERJUAL'),
    };
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
  // (modal) + unit terjual belum cair (modal + laba). Bukan riwayat pencairan.
  fetch: async () => {
    const [units, pending] = await Promise.all([
      stockService.mobilList({ tipe_kepemilikan: 'INVESTOR', limit: 100 }),
      drillService.investorPending(),
    ]);
    const rows: Record<string, unknown>[] = (units.data ?? [])
      .filter((u) => String(u.status ?? '').toUpperCase() !== 'TERJUAL')
      .map((u) => {
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
export const drillPengeluaranUnit = (unit: string, label: string): DrillSpec => ({
  key: `pengeluaran-${unit}`,
  label: `Rincian ${label}`,
  columns: [
    tgl(),
    { key: 'nomor_transaksi', header: 'Nomor' },
    { key: 'kategori', header: 'Kategori' },
    { key: 'deskripsi', header: 'Deskripsi' },
    rp('jumlah'),
  ],
  fetch: (p: PeriodParams) => drillService.pengeluaranUnit(unit, p),
});

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
