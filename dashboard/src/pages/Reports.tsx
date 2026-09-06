import type { ReactNode } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, Car, CheckCircle2, Scale, TrendingUp, Truck, Wallet, Wrench } from 'lucide-react';
import { drillService, financeService, reportService } from '../api/services';
import { formatCurrency, formatCurrencyDisplay } from '../utils/format';
import { Badge, Card, DataTable, Empty, Loading, PageHeader, ProgressBar, Stat } from '../components/ui';
import {
  Drill,
  FinancialRow,
  KasArusJenisBreakdown,
  KasJenisBreakdown,
  PeriodControls,
  usePeriodFilter,
} from '../components/reports';
import {
  drillAset,
  drillBengkelSales,
  drillGaji,
  drillHutang,
  drillHutangLainnya,
  drillHutangUnit,
  drillInvestor,
  drillInvestorSaldo,
  drillKasbon,
  drillKasJenis,
  drillLembur,
  drillMobilMasuk,
  drillStokMobil,
  drillMuatan,
  drillPembelianPart,
  drillPengeluaranUnit,
  drillPenjualanMobil,
  drillPiutang,
  drillRevaluasi,
  drillPrive,
  drillSetoranKas,
} from '../components/drills';
import { downloadCSV } from './Domains';
import type { CapitalReport, LabaRugiReport, NeracaReport } from '../types/reports';

type Json = Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0);
const nonneg = (v: number) => Math.max(0, v);

// ── Laba Rugi — port frontend/app/laporan/laba-rugi.tsx ─────────────────────
export function LabaRugi() {
  const { filterType, setFilterType, shift, period } = usePeriodFilter('monthly');
  const q = useQuery({
    queryKey: ['laba_rugi', period.tanggal_dari, period.tanggal_sampai],
    queryFn: () => reportService.labaRugi({ tanggal_dari: period.tanggal_dari, tanggal_sampai: period.tanggal_sampai }),
  });
  const r = q.data as LabaRugiReport | undefined;

  if (q.isLoading) return <Loading />;
  if (q.isError || !r) return <Empty text="Gagal memuat laba rugi." />;

  const b = r.units.bengkel;
  const bd = r.bengkel_details ?? { total_parts: 0, total_jasa: 0, total_diskon: 0, total_subtotal: 0 };
  const penjualanBengkel = bd.total_subtotal || b.revenue + bd.total_diskon;
  const ja = r.units.jasa_angkut;
  const m = r.units.mobil;
  const md = r.mobil_details ?? {};
  const prepSold = m.beban_operasional || 0;
  const prepAll = md.total_biaya_persiapan ?? prepSold;
  const repairSold = nonneg(m.maintenance ?? md.total_biaya_bengkel ?? md.biaya_bengkel ?? 0);
  const penalti = m.dana_penalti ?? m.pendapatan_lainnya ?? 0;

  const unitCard = (
    accent: string,
    icon: ReactNode,
    title: string,
    tag: string,
    body: ReactNode,
    laba: number,
    labaLabel: string,
  ) => (
    <section className="animate-fade-up overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>{icon}</span>
          <div>
            <h3 className="text-base font-extrabold tracking-tight text-slate-900">{title}</h3>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{tag}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-extrabold tabular-nums ${laba < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {laba < 0 ? `(${formatCurrency(Math.abs(laba))})` : formatCurrency(laba)}
        </span>
      </div>
      <div className="p-5 pt-3">{body}</div>
      <div className="mx-5 mb-5 rounded-xl bg-slate-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{labaLabel}</p>
          <p className={`text-base font-extrabold tabular-nums ${laba < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
            {laba < 0 ? `(${formatCurrency(Math.abs(laba))})` : formatCurrency(laba)}
          </p>
        </div>
      </div>
    </section>
  );

  const groupLabel = (text: string, tone: string) => (
    <p className={`mb-1.5 mt-3 text-[10px] font-extrabold uppercase tracking-[0.12em] ${tone}`}>{text}</p>
  );

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="Laba Rugi" sub="Analisa finansial per unit bisnis" />
      <PeriodControls filterType={filterType} onType={setFilterType} label={period.label} onPrev={() => shift(-1)} onNext={() => shift(1)} />

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Revenue', r.summary.total_revenue ?? penjualanBengkel + ja.revenue + m.revenue, 'text-slate-900'],
          ['Laba Operasional', r.summary.laba_operasional, (r.summary.laba_operasional ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'],
          ['Prive', r.summary.prive, 'text-rose-600'],
          ['Laba Bersih', r.summary.laba_bersih, (r.summary.laba_bersih ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'],
        ].map(([label, value, cls]) => (
          <div key={label as string} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className={`mt-1 truncate text-lg font-extrabold tabular-nums ${cls}`}>{formatCurrency(value as number)}</p>
          </div>
        ))}
      </div>

      {unitCard(
        'bg-indigo-100 text-indigo-600',
        <Wrench size={19} />,
        'Unit Bengkel',
        'Revenue Center',
        <>
          {groupLabel('I. Pendapatan Operasional', 'text-indigo-600')}
          <FinancialRow label="Penjualan Sparepart & Jasa" value={penjualanBengkel} bold large />
          <Drill spec={drillBengkelSales()} period={period} amountKey="grand_total" total={penjualanBengkel} />
          <FinancialRow label="Sparepart (Retail)" value={bd.total_parts} small indent />
          <Drill spec={drillBengkelSales()} period={period} amountKey="total_parts" total={bd.total_parts} />
          <FinancialRow label="Jasa Servis" value={bd.total_jasa} small indent />
          <Drill spec={drillBengkelSales()} period={period} amountKey="total_jasa" total={bd.total_jasa} />
          <FinancialRow label="Diskon Penjualan" value={bd.total_diskon} small indent isNegative color="text-rose-500" />
          <Drill spec={drillBengkelSales()} period={period} amountKey="diskon" total={bd.total_diskon} />
          {groupLabel('II. Beban Pokok (HPP)', 'text-slate-500')}
          <FinancialRow label="HPP Sparepart Terjual" value={b.hpp} isNegative color="text-rose-600" />
          <Drill spec={drillBengkelSales()} period={period} amountKey="hpp_parts" total={b.hpp} />
          <div className="mt-2 rounded-xl bg-indigo-50/70 px-3 py-1.5">
            <FinancialRow label="Laba Kotor Bengkel" value={b.laba_kotor} bold color="text-indigo-700" />
          </div>
          {groupLabel('III. Beban Operasional', 'text-slate-500')}
          <FinancialRow label="Beban Gaji" value={b.beban_gaji ?? 0} isNegative small />
          <Drill spec={drillGaji()} period={period} amountKey="gaji_pokok" total={b.beban_gaji ?? 0} />
          <FinancialRow label="Beban Lembur" value={b.beban_lembur ?? 0} isNegative small />
          <Drill spec={drillLembur()} period={period} amountKey="uang_lembur" total={b.beban_lembur ?? 0} />
          <FinancialRow label="Beban Operasional Unit" value={b.beban_operasional} isNegative small />
          <Drill spec={drillPengeluaranUnit('bengkel', 'operasional bengkel')} period={period} amountKey="jumlah" total={b.beban_operasional} />
        </>,
        b.laba_bersih,
        'Laba bersih unit',
      )}

      {unitCard(
        'bg-emerald-100 text-emerald-600',
        <Truck size={19} />,
        'Unit Jasa Angkut',
        'Logistic Service',
        <>
          {groupLabel('I. Pendapatan Operasional', 'text-emerald-600')}
          <FinancialRow label="Pendapatan Jasa (Kotor Unit)" value={ja.revenue} bold large />
          <Drill spec={drillMuatan()} period={period} amountKey="pendapatan_kotor" total={ja.revenue} />
          {groupLabel('II. Biaya Armada & Maintenance', 'text-slate-500')}
          <FinancialRow label="Pemeliharaan (Bengkel)" value={ja.maintenance ?? 0} isNegative small color="text-rose-600" />
          <Drill spec={drillMuatan()} period={period} amountKey="total_biaya" total={ja.maintenance ?? 0} />
          <FinancialRow label="Operasional (BBM, Tol, dll)" value={ja.beban_operasional} isNegative small color="text-rose-600" />
          <Drill spec={drillPengeluaranUnit('jasa_angkut', 'operasional angkut')} period={period} amountKey="jumlah" total={ja.beban_operasional} />
          {groupLabel('III. Biaya Umum Unit', 'text-slate-500')}
          <FinancialRow label="Beban Umum Jasa Angkut" value={ja.beban_umum ?? 0} isNegative small />
          <Drill spec={drillPengeluaranUnit('jasa_angkut', 'umum angkut')} period={period} amountKey="jumlah" total={ja.beban_umum ?? 0} />
        </>,
        ja.laba_bersih,
        'Laba bersih unit',
      )}

      {unitCard(
        'bg-amber-100 text-amber-600',
        <Car size={19} />,
        'Unit Jual Beli Mobil',
        'Car Trading',
        <>
          {groupLabel('I. Pendapatan Penjualan', 'text-amber-600')}
          <FinancialRow label="Total Penjualan Unit (Gross)" value={m.revenue} bold large />
          <Drill spec={drillPenjualanMobil()} period={period} amountKey="harga_jual" total={m.revenue} />
          {penalti > 0 && (
            <div className="mt-2 rounded-xl bg-amber-50 px-3 py-1.5">
              <FinancialRow label="Penalti Pembatalan Booking" value={penalti} bold small color="text-amber-800" />
              <Drill spec={drillPenjualanMobil()} period={period} amountKey="dana_penalti" total={penalti} />
            </div>
          )}
          {groupLabel('II. Beban Pokok (HPP)', 'text-slate-500')}
          <FinancialRow label="Harga Beli Unit" value={m.hpp} isNegative small color="text-rose-600" />
          <Drill spec={drillPenjualanMobil()} period={period} amountKey="harga_beli" total={m.hpp} />
          <FinancialRow label="Biaya Persiapan Terjual" value={prepSold} isNegative small color="text-rose-600" />
          <Drill spec={drillPengeluaranUnit('jual_beli_mobil', 'persiapan mobil')} period={period} amountKey="jumlah" total={prepSold} />
          <FinancialRow label="Perbaikan Bengkel Terjual" value={repairSold} isNegative small color="text-rose-600" />
          <Drill spec={drillBengkelSales()} period={period} amountKey="grand_total" total={repairSold} />
          {prepAll > prepSold && (
            <p className="mt-1 text-[11px] text-slate-400">Info: persiapan semua stok {formatCurrency(prepAll)} (belum terjual {formatCurrency(prepAll - prepSold)}).</p>
          )}
          {groupLabel('III. Beban Umum Unit', 'text-slate-500')}
          {(m.sharing_investor || 0) > 0 && (
            <>
              <FinancialRow label="Bagi Hasil Investor" value={m.sharing_investor || 0} isNegative small color="text-rose-600" />
              <Drill spec={drillInvestor()} period={period} amountKey="nominal" total={m.sharing_investor || 0} />
            </>
          )}
          <FinancialRow label="Beban Umum & Operasional" value={m.beban_umum ?? 0} isNegative small />
          <Drill spec={drillPengeluaranUnit('jual_beli_mobil', 'umum mobil')} period={period} amountKey="jumlah" total={m.beban_umum ?? 0} />
        </>,
        m.laba_bersih,
        'Laba bersih unit',
      )}

      <Card title="Biaya Operasional Pusat" sub="Beban umum & lainnya" icon={Wallet}>
        <FinancialRow label="Total Beban Umum & Lainnya" value={r.summary.total_beban_umum} isNegative bold large />
        <Drill spec={drillPengeluaranUnit('umum', 'beban umum pusat')} period={period} amountKey="jumlah" total={r.summary.total_beban_umum} />
        {(r.summary.internal_profit_elimination || 0) > 0 && (
          <FinancialRow label="Info Laba Internal Mobil Belum Terjual" value={r.summary.internal_profit_elimination || 0} small color="text-amber-700" />
        )}
      </Card>

      {(r.kas_per_jenis?.length ?? 0) > 0 && (
        <Card title="Arus Kas per Akun" sub="Mutasi kas periode ini — bukan komponen laba" icon={Banknote}>
          <KasArusJenisBreakdown flows={r.kas_per_jenis} period={period} />
        </Card>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-[#0B1F3A] p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-300" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Financial Summary</p>
          </div>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Laba operasional seluruh unit</span>
              <span className="font-extrabold tabular-nums">{formatCurrency(r.summary.laba_operasional)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Prive pemilik</span>
              <span className="font-extrabold tabular-nums text-rose-300">−{formatCurrency(r.summary.prive)}</span>
            </div>
          </div>
          <div className="my-4 h-px bg-white/10" />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Laba bersih akhir</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">
                {r.summary.laba_bersih < 0 ? `(${formatCurrency(Math.abs(r.summary.laba_bersih))})` : formatCurrency(r.summary.laba_bersih)}
              </p>
            </div>
            <Badge tone={r.summary.laba_bersih >= 0 ? 'ok' : 'bad'}>{r.summary.laba_bersih >= 0 ? 'PROFIT' : 'LOSS'}</Badge>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Neraca — port frontend/app/laporan/neraca.tsx ────────────────────────────
export function Neraca() {
  const { filterType, setFilterType, shift, period } = usePeriodFilter('monthly');
  const asOf = period.tanggal_sampai;
  const q = useQuery({ queryKey: ['neraca', asOf], queryFn: () => reportService.neraca(asOf) });
  const r = q.data as NeracaReport | undefined;

  if (q.isLoading) return <Loading />;
  if (q.isError || !r) return <Empty text="Gagal memuat neraca." />;

  const al = r.aktiva_lancar;
  const at = r.aktiva_tetap;
  const m = r.modal;
  const h = r.hutang;
  const stockDetails = al.stok_mobil_detail || [];
  const stockFromDetails = stockDetails.reduce((a, it) => a + (it.total || 0), 0);
  const stokAdj = al.stok_mobil || stockFromDetails || 0;
  const breakdown = stockDetails.reduce(
    (a, it) => ({
      harga_beli: a.harga_beli + Number(it.harga_beli || 0),
      biaya_persiapan: a.biaya_persiapan + Number(it.biaya_persiapan || 0),
      perbaikan_external: a.perbaikan_external + Number(it.perbaikan_external || 0),
      perbaikan_internal: a.perbaikan_internal + Number(it.perbaikan_internal || 0),
    }),
    { harga_beli: 0, biaya_persiapan: 0, perbaikan_external: 0, perbaikan_internal: 0 },
  );
  const labaAdj = m.laba_ditahan ?? r.cross_validation?.retained_earnings ?? 0;
  const unitCashDetails = Array.isArray(al.unit_cash_details)
    ? al.unit_cash_details
    : Object.entries(al.unit_details || {}).map(([unit, total_cash]) => ({ unit, total_cash: Number(total_cash || 0) }));
  const modalBottomUp = r.modal?.modal_komponen ?? (m.setoran_modal + m.laba_ditahan - m.prive);
  const modalIdentity = r.modal?.equity_identity ?? (r.total_aktiva - h.total_hutang);
  const selisihModal = r.modal?.selisih_modal ?? modalBottomUp - modalIdentity;

  const sectionHead = (title: string, sub: string, total: number, tone: string, icon: ReactNode) => (
    <div className="flex items-center justify-between gap-3 border-b border-slate-50 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500">{icon}</span>
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-slate-900">{title}</h3>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{sub}</p>
        </div>
      </div>
      <span className={`rounded-full px-3 py-1 text-sm font-extrabold tabular-nums ${tone}`}>{formatCurrencyDisplay(total)}</span>
    </div>
  );

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="Neraca" sub={`Posisi keuangan per ${period.label}`} right={<Badge tone={r.is_balanced ? 'ok' : 'bad'}>{r.is_balanced ? 'BALANCED' : `SELISIH ${formatCurrencyDisplay(r.selisih)}`}</Badge>} />
      <PeriodControls filterType={filterType} onType={setFilterType} label={period.label} onPrev={() => shift(-1)} onNext={() => shift(1)} />

      <div className="relative overflow-hidden rounded-3xl bg-[#0B1F3A] p-6 text-white shadow-xl sm:p-7">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Scale size={18} className="text-emerald-300" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Balance Sheet · Aktiva = Pasiva</p>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-3">
          {[
            ['Aktiva', r.total_aktiva],
            ['Pasiva', r.total_pasiva],
            ['Selisih', r.selisih],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
              <p className={`mt-1 truncate text-base font-extrabold tabular-nums sm:text-xl ${label === 'Selisih' && Math.abs(value as number) >= 100 ? 'text-amber-300' : ''}`}>
                {formatCurrencyDisplay(value as number)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <h2 className="flex items-center gap-2 px-1 text-sm font-extrabold uppercase tracking-wider text-slate-500">
        <span className="h-5 w-1 rounded-full bg-emerald-500" /> Aktiva · Harta Perusahaan
      </h2>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        {sectionHead('Aktiva Lancar', 'Current Assets', al.total_aktiva_lancar, 'bg-emerald-50 text-emerald-700', <Banknote size={17} />)}
        <div className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Kas & Bank</p>
            <div className="pl-3">
              <FinancialRow label="Kas Tunai (Utama)" value={al.kas_tunai} small />
              <Drill spec={drillKasJenis('KAS_UTAMA', 'Kas Utama')} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="signed" total={0} hideDiff />
              <FinancialRow label="Kas Bank" value={al.kas_bank} small />
              <Drill spec={drillKasJenis('BANK_UTAMA', 'Bank Utama')} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="signed" total={0} hideDiff />
              <FinancialRow label="Kas di Unit Operasional" value={al.unit_cash} small />
              {unitCashDetails.map((u, i) => (
                <FinancialRow key={i} label={u.unit.toUpperCase()} value={u.total_cash} small indent />
              ))}
              <div className="my-2 h-px w-full bg-slate-100" />
              <FinancialRow label="Total Kas & Bank" value={al.total_kas_bank} bold color="text-emerald-700" />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Piutang Usaha</p>
            <div className="pl-3">
              <FinancialRow label="Piutang Lainnya / Manual Unit" value={al.piutang_lainnya} small />
              <Drill spec={drillPiutang('LAINNYA', 'Rincian piutang lainnya')} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="sisa_piutang" total={al.piutang_lainnya} />
              {(al.piutang_karyawan || 0) > 0 && (
                <>
                  <FinancialRow label="Piutang Karyawan (Kasbon)" value={al.piutang_karyawan} small />
                  <Drill spec={drillKasbon()} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="sisa" total={al.piutang_karyawan} />
                </>
              )}
              {(al.piutang_usaha || 0) > 0 && (
                <>
                  <FinancialRow label="Piutang Unit Bengkel" value={al.piutang_usaha} small />
                  <Drill spec={drillPiutang('BENGKEL', 'Rincian piutang bengkel')} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="sisa_piutang" total={al.piutang_usaha} />
                </>
              )}
              {(al.piutang_mobil || 0) > 0 && (
                <>
                  <FinancialRow label="Piutang Unit Mobil" value={al.piutang_mobil} small />
                  <Drill spec={drillPiutang('JUAL_BELI_MOBIL', 'Rincian piutang mobil')} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="sisa_piutang" total={al.piutang_mobil} />
                </>
              )}
              {(al.piutang_jasa_angkut || 0) > 0 && (
                <>
                  <FinancialRow label="Piutang Jasa Angkut" value={al.piutang_jasa_angkut} small />
                  <Drill spec={drillPiutang('JASA_ANGKUT', 'Rincian piutang angkut')} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="sisa_piutang" total={al.piutang_jasa_angkut} />
                </>
              )}
              <div className="my-2 h-px w-full bg-slate-100" />
              <FinancialRow label="Total Piutang" value={al.total_piutang || 0} bold color="text-indigo-700" />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Persediaan & Stok</p>
            <div className="pl-3">
              <FinancialRow label="Persediaan Sparepart" value={al.persediaan_sparepart} small />
              <Drill spec={drillPembelianPart()} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="grand_total" total={al.persediaan_sparepart} />
              <FinancialRow label="Stok Mobil (Inventory)" value={stokAdj} small />
              <Drill spec={drillStokMobil()} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="harga_beli" total={stokAdj} />
              {stokAdj > 0 && (
                <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                  <FinancialRow label="Harga Beli Unit" value={breakdown.harga_beli || stokAdj} small indent />
                  {breakdown.biaya_persiapan > 0 && <FinancialRow label="Biaya Persiapan" value={breakdown.biaya_persiapan} small indent />}
                  {breakdown.perbaikan_external > 0 && <FinancialRow label="Perbaikan Eksternal" value={breakdown.perbaikan_external} small indent />}
                  {breakdown.perbaikan_internal > 0 && <FinancialRow label="Perbaikan Internal Bengkel" value={breakdown.perbaikan_internal} small indent color="text-amber-700" />}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {sectionHead('Aktiva Tetap', 'Fixed Assets', at.total_aktiva_tetap, 'bg-indigo-50 text-indigo-700', <Banknote size={17} />)}
        <div className="p-5 pl-7">
          {at.detail_aset?.length > 0 ? (
            at.detail_aset.map((a, i) => <FinancialRow key={i} label={`${a.kode} - ${a.nama}`} value={a.harga_beli} small />)
          ) : (
            <p className="py-4 text-center text-xs text-slate-400">Belum ada aset terdaftar</p>
          )}
          <Drill spec={drillAset()} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="harga_beli" total={at.total_aktiva_tetap} />
          <div className="my-3 h-px w-full bg-slate-100" />
          <FinancialRow label="Total Aktiva Tetap" value={at.total_aktiva_tetap} bold color="text-indigo-700" />
        </div>
      </section>

      <h2 className="px-2 text-lg font-bold">PASIVA <span className="text-xs font-normal text-slate-400">Kewajiban & Modal</span></h2>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {sectionHead('Modal', 'Equity', m.total_modal, 'bg-indigo-50 text-indigo-700', <Wallet size={17} />)}
        <div className="space-y-4 p-5">
          <div>
            <FinancialRow label="1. Setoran Modal" value={m.setoran_modal} bold large />
            {(m.setoran_modal_kas > 0 || m.modal_non_kas > 0) && (
              <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                {m.setoran_modal_kas > 0 && <FinancialRow label="Modal Tunai (Kas)" value={m.setoran_modal_kas} small indent />}
                {m.modal_non_kas > 0 && <FinancialRow label="Modal Non-Kas (Aset)" value={m.modal_non_kas} small indent />}
              </div>
            )}
          </div>
          {m.modal_non_kas > 0 && (m.modal_persediaan > 0 || m.modal_stok_mobil > 0 || m.modal_aset_tetap > 0) && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Detail Modal Non-Kas</p>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                {m.modal_persediaan > 0 && <FinancialRow label="Persediaan Sparepart" value={m.modal_persediaan} small indent />}
                {m.modal_stok_mobil > 0 && <FinancialRow label="Stok Mobil (Inventory)" value={m.modal_stok_mobil} small indent />}
                {m.modal_aset_tetap > 0 && <FinancialRow label="Aset Tetap" value={m.modal_aset_tetap} small indent />}
              </div>
            </div>
          )}
          <FinancialRow label="2. Laba Ditahan" value={labaAdj} bold large color="text-indigo-700" />
          <div>
            <FinancialRow label="Penyesuaian Harga Beli Spare Part (Memo)" value={m.penyesuaian_harga_beli_sparepart ?? 0} bold large color="text-indigo-700" />
            <Drill spec={drillRevaluasi()} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="amount" total={m.penyesuaian_harga_beli_sparepart ?? 0} />
            <p className="mt-1 text-[10px] text-slate-400">Informasi saja — stok sudah dinilai historical cost, tidak menambah/mengurangi total modal.</p>
          </div>
          <FinancialRow label="3. Prive (Pengambilan Pemilik)" value={m.prive} isNegative bold large />
          {(m.prive || 0) > 0 && <Drill spec={drillPrive()} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="nominal" total={m.prive} />}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {sectionHead('Hutang', 'Liabilities', h.total_hutang, 'bg-rose-50 text-rose-700', <Wallet size={17} />)}
        <div className="p-5">
          <FinancialRow label="1. Hutang Pembelian Part" value={h.hutang_part} small large />
          <Drill spec={drillHutangUnit('BENGKEL', ['PEMBELIAN_PART', 'LAINNYA'], 'Rincian hutang part')} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="sisa_hutang" total={h.hutang_part} />
          <FinancialRow label="2. Hutang Pembelian Mobil" value={h.hutang_mobil} small large />
          <Drill spec={drillHutangUnit('JUAL_BELI_MOBIL', ['PEMBELIAN_MOBIL', 'JUAL_BELI_MOBIL', 'LAINNYA'], 'Rincian hutang mobil')} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="sisa_hutang" total={h.hutang_mobil} />
          <FinancialRow label="3. Hutang Investor" value={h.hutang_investor} small large />
          <Drill spec={drillInvestorSaldo()} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="total" total={h.hutang_investor} />
          <FinancialRow label="4. Hutang Lainnya / Manual Unit" value={h.hutang_lainnya} small large />
          <Drill spec={drillHutangLainnya('Rincian hutang lainnya')} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="sisa_hutang" total={h.hutang_lainnya} />
          {(h.hutang_jasa_angkut || 0) > 0 && (
            <>
              <FinancialRow label="5. Hutang Jasa Angkut" value={h.hutang_jasa_angkut || 0} small large />
              <Drill spec={drillHutang('JASA_ANGKUT', 'Rincian hutang angkut')} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="sisa_hutang" total={h.hutang_jasa_angkut || 0} />
            </>
          )}
          {(h.uang_muka_penjualan || 0) > 0 && (
            <>
              <FinancialRow label="Uang Muka Penjualan" value={h.uang_muka_penjualan || 0} small large />
              <Drill spec={drillHutang('UANG_MUKA_PENJUALAN', 'Rincian uang muka')} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="sisa_hutang" total={h.uang_muka_penjualan || 0} />
            </>
          )}
          {(h.piutang_booking || 0) > 0 && (
            <>
              <FinancialRow label="Sisa Kewajiban Booking Mobil" value={h.piutang_booking || 0} small large />
              <Drill spec={drillPiutang('JUAL_BELI_MOBIL', 'Rincian booking mobil')} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: asOf }} amountKey="sisa_piutang" total={h.piutang_booking || 0} />
            </>
          )}
          <div className="my-3 h-px w-full bg-slate-100" />
          <div className="rounded-xl border border-rose-100/50 bg-rose-50 p-4">
            <FinancialRow label="Total Hutang" value={h.total_hutang} bold large color="text-rose-800" />
          </div>
        </div>
      </section>

      <section className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl sm:p-7 ${r.is_balanced ? 'bg-[#0B1F3A]' : 'bg-amber-700'}`}>
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Scale size={18} className="text-emerald-300" />
          <div>
            <h3 className="font-extrabold tracking-tight">Keseimbangan Neraca</h3>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Balance Check</p>
          </div>
        </div>
        <div className="relative mt-4 space-y-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
          <div className="flex justify-between"><span className="text-slate-300">Total Aktiva</span><b className="tabular-nums">{formatCurrency(r.total_aktiva)}</b></div>
          <div className="flex justify-between"><span className="text-slate-300">Total Pasiva</span><b className="tabular-nums">{formatCurrency(r.total_pasiva)}</b></div>
          <div className="my-2 h-px bg-white/10" />
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Selisih</span>
            <span className={`text-xl font-extrabold tabular-nums ${Math.abs(r.selisih) < 100 ? 'text-emerald-300' : 'text-amber-300'}`}>
              {formatCurrencyDisplay(r.selisih)}
            </span>
          </div>
        </div>
        <div className="relative mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Validasi Komponen Modal</p>
          <div className="flex justify-between"><span className="text-slate-300">Bottom-Up</span><b className="tabular-nums">{formatCurrency(modalBottomUp)}</b></div>
          <div className="flex justify-between"><span className="text-slate-300">Aktiva − Hutang</span><b className="tabular-nums">{formatCurrency(modalIdentity)}</b></div>
          <div className="flex justify-between"><span className="text-slate-300">Selisih Modal</span><b className={`tabular-nums ${Math.abs(selisihModal) < 100 ? 'text-emerald-300' : 'text-amber-300'}`}>{formatCurrencyDisplay(Math.abs(selisihModal))}</b></div>
        </div>
        <div className="relative mt-3 text-center">
          <Badge tone={r.is_balanced ? 'ok' : 'warn'}>{r.is_balanced ? 'NERACA SEIMBANG' : 'TERDAPAT SELISIH'}</Badge>
        </div>
      </section>
    </div>
  );
}

// ── Perubahan Modal — port frontend/app/laporan/perubahan-modal.tsx ──────────
export function Modal() {
  const { filterType, setFilterType, shift, period } = usePeriodFilter('monthly');
  const q = useQuery({
    queryKey: ['modal', period.tanggal_dari, period.tanggal_sampai],
    queryFn: () => reportService.modal({ tanggal_dari: period.tanggal_dari, tanggal_sampai: period.tanggal_sampai }),
  });
  const r = q.data as CapitalReport | undefined;

  if (q.isLoading) return <Loading />;
  if (q.isError || !r) return <Empty text="Gagal memuat perubahan modal." />;

  const modalAwal = r.modal_awal || 0;
  const setoranKas = r.penambahan?.setoran_modal || 0;
  const penyesuaianHargaBeli = r.penambahan?.penyesuaian_harga_beli_sparepart || 0;
  const modalNonKas = r.penambahan?.modal_non_kas?.total || 0;
  const investorFunding = r.penambahan?.investor_funding || 0;
  const labaBersih = r.info?.laba_bersih || 0;
  const labaInvestor = r.info?.laba_investor || 0;
  const diskon = r.info?.diskon_penjualan_bengkel || 0;
  const prive = (r.pengurangan?.prive || 0) + (r.pengurangan?.pengembalian_modal || 0);
  const pembayaranInvestor = r.pengurangan?.pembayaran_investor || 0;
  const modalAkhir = r.modal_akhir || 0;
  const perubahanBersih = setoranKas + modalNonKas + investorFunding + labaBersih + labaInvestor - prive - pembayaranInvestor;
  const expectedAliran = modalAwal + perubahanBersih;
  const expected = r.info?.validasi?.modal_teoritis ?? expectedAliran;
  const selisih = r.info?.validasi?.selisih ?? r.selisih ?? modalAkhir - expected;
  const isBalanced = r.is_balanced ?? Math.abs(selisih) < 100;

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="Perubahan Modal" sub="Aliran ekuitas pemilik per periode" right={<Badge tone={isBalanced ? 'ok' : 'warn'}>{isBalanced ? 'BALANCE' : 'SELISIH'}</Badge>} />
      <PeriodControls filterType={filterType} onType={setFilterType} label={period.label} onPrev={() => shift(-1)} onNext={() => shift(1)} />

      <div className="relative overflow-hidden rounded-3xl bg-[#0B1F3A] p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-indigo-300" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Modal akhir periode</p>
          </div>
          <p className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">{formatCurrency(modalAkhir)}</p>
          <p className="mt-2 text-sm text-slate-400">
            Awal {formatCurrency(modalAwal)} · Δ {formatCurrency(modalAkhir - modalAwal)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Modal Awal', modalAwal, 'Saldo awal periode'],
          ['Laba Bersih', labaBersih, 'Laba periode berjalan'],
          ['Setoran', setoranKas + modalNonKas + investorFunding, 'Kas + non-kas + investor'],
          ['Prive', prive + pembayaranInvestor, 'Penarikan + bayar investor'],
        ].map(([label, value, sub]) => (
          <div key={label as string} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 truncate text-lg font-extrabold tabular-nums text-slate-900">{formatCurrency(value as number)}</p>
            <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      <Card title="Rincian Perubahan Ekuitas">
        <FinancialRow label="Modal Awal" value={modalAwal} bold />
        <FinancialRow label="Penyesuaian Harga Beli Spare Part (Memo)" value={penyesuaianHargaBeli} />
        {penyesuaianHargaBeli !== 0 && <Drill spec={drillRevaluasi()} period={{ tanggal_dari: '2024-01-01', tanggal_sampai: period.tanggal_sampai }} amountKey="amount" total={penyesuaianHargaBeli} />}
        <div className="mt-4 border-t border-slate-50 pt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600">Penambahan</p>
          {setoranKas > 0 && (
            <>
              <FinancialRow label="Setoran Modal Kas" value={setoranKas} color="text-emerald-700" />
              <Drill spec={drillSetoranKas()} period={period} amountKey="nominal" total={setoranKas} />
            </>
          )}
          {modalNonKas !== 0 && <FinancialRow label="Penyesuaian" value={modalNonKas} color={modalNonKas < 0 ? 'text-rose-600' : 'text-emerald-700'} />}
          {investorFunding > 0 && (
            <>
              <FinancialRow label="Dana Investor Mobil" value={investorFunding} color="text-emerald-700" />
              <Drill spec={drillMobilMasuk()} period={period} amountKey="nominal_investor" total={investorFunding} />
            </>
          )}
          {labaBersih >= 0 && (
            <>
              <FinancialRow label="Laba Bersih Periode" value={labaBersih} color="text-emerald-700" />
              {diskon > 0 && <p className="mb-2 pl-1 text-[11px] text-slate-500">· info: diskon bengkel {formatCurrency(diskon)} sudah di laba (bukan baris modal terpisah)</p>}
            </>
          )}
          {labaInvestor > 0 && <FinancialRow label="Laba Investor (Unit Terjual)" value={labaInvestor} color="text-emerald-700" />}
        </div>
        <div className="mt-4 border-t border-slate-50 pt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-rose-600">Pengurangan</p>
          <FinancialRow label="Prive / Pengambilan Pemilik" value={prive} isNegative={prive > 0} />
          {prive > 0 && <Drill spec={drillPrive()} period={period} amountKey="nominal" total={prive} />}
          {labaBersih < 0 && (
            <>
              <FinancialRow label="Rugi Periode" value={Math.abs(labaBersih)} isNegative />
              {diskon > 0 && <p className="mb-2 pl-1 text-[11px] text-slate-500">· info: diskon bengkel {formatCurrency(diskon)} sudah di laba (bukan baris modal terpisah)</p>}
            </>
          )}
          {labaInvestor < 0 && <FinancialRow label="Rugi Investor (Jual Beli Mobil)" value={Math.abs(labaInvestor)} isNegative />}
          {pembayaranInvestor > 0 && (
            <>
              <FinancialRow label="Pembayaran Investor Mobil" value={pembayaranInvestor} isNegative />
              <Drill spec={drillInvestor()} period={period} amountKey="nominal" total={pembayaranInvestor} />
            </>
          )}
        </div>
        <div className="mt-4 border-t-2 border-slate-100 pt-5">
          <FinancialRow label="Perubahan Bersih Modal (Aliran)" value={perubahanBersih} bold color="text-slate-700" />
          <FinancialRow label="Modal Akhir Periode (Teoritis)" value={expected} bold color="text-indigo-700" />
        </div>
      </Card>

      <section className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl sm:p-7 ${isBalanced ? 'bg-[#0B1F3A]' : 'bg-amber-700'}`}>
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Scale size={18} className="text-indigo-300" />
          <div>
            <h3 className="font-extrabold tracking-tight">Keseimbangan Ekuitas</h3>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Capital Balance Check</p>
          </div>
        </div>
        <div className="relative mt-4 space-y-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
          <div className="flex justify-between"><span className="text-slate-300">Aktual (Neraca)</span><b className="tabular-nums">{formatCurrency(modalAkhir)}</b></div>
          <div className="flex justify-between"><span className="text-slate-300">Teoritis (Backend)</span><b className="tabular-nums">{formatCurrency(expected)}</b></div>
          <div className="my-2 h-px bg-white/10" />
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Selisih</span>
            <span className={`text-xl font-extrabold tabular-nums ${isBalanced ? 'text-emerald-300' : 'text-amber-300'}`}>{formatCurrency(selisih)}</span>
          </div>
        </div>
        <div className="relative mt-3 text-center">
          <Badge tone={isBalanced ? 'ok' : 'warn'}>{isBalanced ? 'MUTASI & NERACA SEIMBANG' : 'TERDAPAT SELISIH'}</Badge>
        </div>
      </section>
    </div>
  );
}

interface PiutangRow {
  nomor: string;
  debitur: string;
  sisa: number;
  jatuh_tempo: string;
  sumber?: string;
}

export function HutangPiutang() {
  const overdue = useQuery({ queryKey: ['piutang_overdue'], queryFn: () => financeService.piutangOverdue(50) });
  const psum = useQuery({ queryKey: ['piutang_sum'], queryFn: () => financeService.piutangSummary() });
  const hsum = useQuery({ queryKey: ['hutang_sum'], queryFn: () => financeService.hutangSummary() });
  const [hpStatus, setHpStatus] = useState('');
  const plist = useQuery({ queryKey: ['piutang_list', hpStatus], queryFn: () => drillService.piutangFiltered({ ...(hpStatus ? { status: hpStatus } : {}) }) });
  const hlist = useQuery({ queryKey: ['hutang_list', hpStatus], queryFn: () => drillService.hutangFiltered({ ...(hpStatus ? { status: hpStatus } : {}) }) });
  const hpSelectCls =
    'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400';
  const rows = ((overdue.data ?? []) as Json[]).map(
    (p): PiutangRow => ({
      nomor: String(p.nomor_piutang ?? p.nomor ?? '-'),
      debitur: String(p.nama_debitur ?? p.nama ?? '-'),
      sisa: num(p.sisa_piutang ?? p.sisa),
      jatuh_tempo: String(p.tanggal_jatuh_tempo ?? '-').slice(0, 10),
      sumber: String(p.sumber ?? '-'),
    }),
  );
  const ps = (psum.data ?? {}) as Record<string, number>;
  const hs = (hsum.data ?? {}) as Record<string, number>;
  const totalOverdue = rows.reduce((a, r) => a + r.sisa, 0);

  const sumCard = (title: string, total: number, sisa: number, count: number, tone: 'emerald' | 'rose', extra?: ReactNode) => (
    <Card title={title}>
      <p className={`text-2xl font-extrabold tabular-nums ${tone === 'emerald' ? 'text-emerald-600' : 'text-rose-600'}`}>
        {formatCurrency(sisa)}
      </p>
      <p className="mt-1 text-xs text-slate-400">dari total {formatCurrency(total)} · {count} akun</p>
      {extra}
    </Card>
  );

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Hutang-Piutang"
        sub="Aging & jatuh tempo · pantau kolektibilitas"
        right={
          rows.length > 0 ? (
            <button
              className="flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#14305a]"
              onClick={() => downloadCSV('hutang-piutang-overdue.csv', ['Nomor', 'Debitur', 'Sisa', 'Jatuh Tempo'], rows.map((r) => [r.nomor, r.debitur, r.sisa, r.jatuh_tempo]))}
            >
              Export CSV
            </button>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Piutang beredar" value={formatCurrency(ps.total_sisa ?? ps.total_piutang)} sub={`${ps.jumlah_belum_lunas ?? 0} belum lunas`} icon={ArrowUpRight} tone="green" />
        <Stat label="Piutang overdue" value={formatCurrency(totalOverdue)} sub={`${rows.length} lewat jatuh tempo`} icon={AlertTriangle} tone="red" />
        <Stat label="Hutang beredar" value={formatCurrency(hs.total_sisa ?? hs.total_hutang)} sub={`${hs.jumlah_belum_lunas ?? 0} belum lunas`} icon={ArrowDownLeft} tone="navy" />
        <Stat label="Net posisi" value={formatCurrency((ps.total_sisa ?? 0) - (hs.total_sisa ?? 0))} sub="Piutang − hutang" icon={Scale} tone="indigo" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          {sumCard('Piutang usaha', ps.total_piutang ?? 0, ps.total_sisa ?? 0, ps.jumlah_belum_lunas ?? 0, 'emerald',
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">Tertagih</span><b>{formatCurrency((ps.total_piutang ?? 0) - (ps.total_sisa ?? 0))}</b></div>
              <ProgressBar value={ps.total_piutang ? ((ps.total_sisa ?? 0) / ps.total_piutang) * 100 : 0} tone="emerald" />
            </div>,
          )}
          {sumCard('Hutang usaha', hs.total_hutang ?? 0, hs.total_sisa ?? 0, hs.jumlah_belum_lunas ?? 0, 'rose',
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">Terbayar</span><b>{formatCurrency((hs.total_hutang ?? 0) - (hs.total_sisa ?? 0))}</b></div>
              <ProgressBar value={hs.total_hutang ? ((hs.total_sisa ?? 0) / hs.total_hutang) * 100 : 0} tone="rose" />
            </div>,
          )}
        </div>
        <Card
          title="Piutang lewat jatuh tempo"
          sub={`${rows.length} akun · ${formatCurrency(totalOverdue)}`}
          icon={AlertTriangle}
          right={rows.length > 0 ? <Badge tone="bad">{rows.length} overdue</Badge> : <Badge tone="ok">Aman</Badge>}
        >
          {overdue.isLoading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty text="Tidak ada piutang overdue. Kolektibilitas sehat." icon={CheckCircle2} />
          ) : (
            <ul className="max-h-[420px] divide-y divide-slate-50 overflow-y-auto">
              {rows.map((r) => (
                <li key={r.nomor} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-sm font-extrabold text-rose-500">
                    {r.debitur.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{r.debitur}</p>
                    <p className="truncate text-xs text-slate-400">{r.nomor} · {r.sumber} · JT {r.jatuh_tempo}</p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums text-rose-600">{formatCurrency(r.sisa)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="Detail Piutang"
          sub="Semua piutang belum lunas"
          icon={ArrowUpRight}
          right={
            <select value={hpStatus} onChange={(e) => setHpStatus(e.target.value)} className={hpSelectCls}>
              <option value="">Semua status</option>
              <option value="BELUM_LUNAS">Belum lunas</option>
              <option value="SEBAGIAN">Sebagian</option>
              <option value="LUNAS">Lunas</option>
            </select>
          }
        >
          {plist.isLoading ? (
            <Loading />
          ) : (
            <DataTable
              headers={['Nomor', 'Debitur', 'Sumber', 'Status', 'Sisa']}
              rows={(((plist.data as { data?: Json[] } | undefined)?.data ?? []) as Json[]).map((p, i) => [
                String(p.nomor_piutang ?? '-'),
                String(p.nama_debitur ?? '-'),
                String(p.sumber ?? '-'),
                String(p.status ?? '-'),
                formatCurrency(num(p.sisa_piutang)),
              ])}
              empty="Tidak ada piutang."
              rightAlignFrom={4}
            />
          )}
        </Card>
        <Card title="Detail Hutang" sub="Semua hutang belum lunas" icon={ArrowDownLeft}>
          {hlist.isLoading ? (
            <Loading />
          ) : (
            <DataTable
              headers={['Nomor', 'Kreditur', 'Sumber', 'Status', 'Sisa']}
              rows={(((hlist.data as { data?: Json[] } | undefined)?.data ?? []) as Json[]).map((h, i) => [
                String(h.nomor_hutang ?? '-'),
                String(h.nama_kreditur ?? '-'),
                String(h.sumber ?? '-'),
                String(h.status ?? '-'),
                formatCurrency(num(h.sisa_hutang)),
              ])}
              empty="Tidak ada hutang."
              rightAlignFrom={4}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
