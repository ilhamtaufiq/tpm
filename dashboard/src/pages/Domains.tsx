import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  CalendarCheck2,
  Car,
  CircleDollarSign,
  Download,
  HandCoins,
  PackageX,
  ReceiptText,
  Truck,
  Users,
} from 'lucide-react';
import { domainService, stockService } from '../api/services';
import { monthStartISO, todayISO } from '../hooks/useDashboard';
import { formatCurrency } from '../utils/format';
import { Badge, Card, DataTable, Empty, Loading, PageHeader, ProgressBar, Stat } from '../components/ui';

type Row = Record<string, unknown>;
const str = (v: unknown, fb = '-') => (v === null || v === undefined || v === '' ? fb : String(v));
const num = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0);

export function downloadCSV(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const exportBtn = (onClick: () => void) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#14305a]"
  >
    <Download size={15} /> Export CSV
  </button>
);

// ── Stok ─────────────────────────────────────────────────────────
export function Stok() {
  const low = useQuery({ queryKey: ['low_stock'], queryFn: stockService.lowStock });
  const stats = useQuery({ queryKey: ['stock_stats'], queryFn: stockService.stats });
  const value = useQuery({ queryKey: ['stock_value'], queryFn: stockService.stockValue });
  const rows = ((low.data ?? []) as Row[]).map((p) => ({
    nama: str(p.nama),
    kode: str(p.kode),
    stok: num(p.stok),
    min: num(p.stok_minimum ?? p.minimum),
    harga: num(p.harga_beli),
    key: str(p.id ?? p.kode ?? p.nama),
  }));
  const s = (stats.data ?? {}) as Row;
  const v = (value.data ?? {}) as Row;
  const nilai = num(v.total_value ?? v.total ?? (s.total_stock_value ?? 0));
  const habis = rows.filter((r) => r.stok <= 0).length;
  const menipis = rows.length - habis;

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Stok Sparepart"
        sub="Level stok, nilai persediaan & butuh restock"
        right={rows.length > 0 ? exportBtn(() => downloadCSV('stok-menipis.csv', ['Kode', 'Nama', 'Stok', 'Min', 'Harga Beli'], rows.map((r) => [r.kode, r.nama, r.stok, r.min, r.harga]))) : undefined}
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Nilai persediaan" value={formatCurrency(nilai)} icon={CircleDollarSign} tone="navy" />
        <Stat label="Total item" value={str(v.total_products ?? v.total_items ?? s.total_items ?? s.total_spare_parts ?? '-')} icon={Boxes} tone="indigo" />
        <Stat label="Menipis" value={String(menipis)} sub="Di bawah minimum" icon={PackageX} tone="amber" />
        <Stat label="Habis" value={String(habis)} sub="Stok nol" icon={PackageX} tone="red" />
      </div>
      <Card title={`Butuh restock (${rows.length})`} sub="Stok menipis & habis" icon={PackageX} right={rows.length > 0 ? <Badge tone="warn">{rows.length} item</Badge> : <Badge tone="ok">Aman</Badge>}>
        {low.isLoading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="Semua stok aman. Tidak ada yang di bawah minimum." icon={Boxes} />
        ) : (
          <DataTable
            headers={['Kode', 'Nama', 'Stok', 'Min', 'Nilai', 'Status']}
            empty="Semua stok aman."
            rightAlignFrom={2}
            rows={rows.map((r) => [
              <span key="k" className="font-mono text-xs font-bold text-slate-600">{r.kode}</span>,
              <span key="n" className="font-medium text-slate-800">{r.nama}</span>,
              <span key="s" className={`font-mono font-extrabold tabular-nums ${r.stok <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>{r.stok}</span>,
              <span key="m" className="font-mono tabular-nums text-slate-500">{r.min}</span>,
              <span key="v" className="font-mono text-xs tabular-nums text-slate-500">{formatCurrency(r.stok * r.harga)}</span>,
              <span key="b"><Badge tone={r.stok <= 0 ? 'bad' : 'warn'}>{r.stok <= 0 ? 'HABIS' : 'MENIPIS'}</Badge></span>,
            ])}
          />
        )}
      </Card>
    </div>
  );
}

// ── Mobil ────────────────────────────────────────────────────────
export function Mobil() {
  const sum = useQuery({
    queryKey: ['mobil_sum'],
    queryFn: () => domainService.mobilSummary({ tanggal_dari: monthStartISO(), tanggal_sampai: todayISO() }),
  });
  const list = useQuery({ queryKey: ['mobil_list'], queryFn: () => stockService.mobilList({ limit: 100 }) });
  const units = (((list.data as Row | undefined)?.data ?? list.data ?? []) as Row[]).map((m) => ({
    key: str(m.id ?? m.kode),
    label: `${str(m.merek)} ${str(m.model)} ${str(m.tahun)}`,
    plat: str(m.nomor_plat ?? m.plat),
    status: str(m.status),
    nilai: num(m.harga_beli ?? m.nilai_buku),
    investor: str(m.tipe_kepemilikan ?? ''),
  }));
  const ms = (sum.data ?? {}) as Row;
  const tersedia = units.filter((u) => u.status === 'TERSEDIA').length;
  const booked = units.filter((u) => u.status === 'BOOKED').length;
  const terjual = units.filter((u) => u.status === 'TERJUAL').length;
  const nilaiStok = units.filter((u) => u.status !== 'TERJUAL').reduce((a, u) => a + u.nilai, 0);

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="Jual Beli Mobil" sub="Stok unit, margin & investor" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Laba TPM" value={formatCurrency(ms.laba_tpm ?? ms.laba_bersih)} sub={`${ms.total_transaksi ?? terjual} unit terjual`} icon={CircleDollarSign} tone="green" />
        <Stat label="Nilai stok" value={formatCurrency(nilaiStok)} sub={`${tersedia + booked} unit di tangan`} icon={Car} tone="navy" />
        <Stat label="Booked" value={String(booked)} sub="Menunggu pelunasan" icon={ReceiptText} tone="amber" />
        <Stat label="Modal investor" value={formatCurrency(ms.total_modal_investor ?? ms.nominal_investor)} sub="Dana pihak ketiga" icon={HandCoins} tone="indigo" />
      </div>
      <Card title={`Unit (${units.length})`} sub="Status stok · booked · terjual" icon={Car}>
        {list.isLoading ? (
          <Loading />
        ) : units.length === 0 ? (
          <Empty text="Tidak ada unit." icon={Car} />
        ) : (
          <ul className="divide-y divide-slate-50">
            {units.map((u) => (
              <li key={u.key} className="flex items-center gap-3 py-2.5">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${u.status === 'TERJUAL' ? 'bg-emerald-50 text-emerald-600' : u.status === 'BOOKED' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  <Car size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{u.label}</p>
                  <p className="truncate text-xs text-slate-400">{u.plat}{u.investor ? ` · ${u.investor}` : ''}</p>
                </div>
                <span className="hidden text-xs tabular-nums text-slate-500 sm:block">{formatCurrency(u.nilai)}</span>
                <Badge tone={u.status === 'TERJUAL' ? 'ok' : u.status === 'BOOKED' ? 'warn' : 'info'}>{u.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ── Angkut ───────────────────────────────────────────────────────
export function Angkut() {
  const sum = useQuery({
    queryKey: ['muatan_sum'],
    queryFn: () => domainService.muatanSummary({ tanggal_dari: monthStartISO(), tanggal_sampai: todayISO() }),
  });
  const d = (sum.data ?? {}) as Row;
  const det = (d.details ?? {}) as Row;
  const ritase = num(d.total_ritase ?? d.total_transaksi ?? d.total_muatan ?? 0);

  const costRows = [
    { label: 'BBM', value: num(det.biaya_bbm ?? d.biaya_bbm) },
    { label: 'Tol', value: num(det.biaya_tol ?? d.biaya_tol) },
    { label: 'Supir / operasional', value: num(det.biaya_supir ?? det.biaya_operasional ?? d.biaya_operasional) },
    { label: 'Lainnya', value: num(det.biaya_lainnya ?? d.biaya_lainnya) },
  ].filter((r) => r.value > 0);
  const totalCost = costRows.reduce((a, r) => a + r.value, 0);

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="Jasa Angkut" sub="Laba per trip, biaya & kasbon supir" />
      {sum.isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Pendapatan" value={formatCurrency(d.total_pendapatan ?? d.pendapatan_kotor)} icon={CircleDollarSign} tone="green" />
            <Stat label="Laba TPM" value={formatCurrency(d.laba_tpm ?? d.laba_bersih)} icon={Truck} tone="navy" />
            <Stat label="Ritase" value={str(ritase || '-')} sub="Trip periode ini" icon={ReceiptText} tone="indigo" />
            <Stat label="Kasbon supir" value={formatCurrency(d.kasbon_outstanding ?? d.total_kasbon)} sub="Belum dipertanggungjawabkan" icon={HandCoins} tone="amber" />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Komposisi biaya" sub="Periode berjalan" icon={ReceiptText}>
              {costRows.length === 0 ? (
                <Empty text="Belum ada rincian biaya." />
              ) : (
                <div className="space-y-3">
                  {costRows.map((r) => (
                    <div key={r.label}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-bold text-slate-600">{r.label}</span>
                        <b className="tabular-nums">{formatCurrency(r.value)}</b>
                      </div>
                      <ProgressBar value={totalCost ? (r.value / totalCost) * 100 : 0} tone="indigo" />
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-100 pt-2 text-sm">
                    <b>Total biaya</b>
                    <b className="tabular-nums text-rose-600">{formatCurrency(totalCost)}</b>
                  </div>
                </div>
              )}
            </Card>
            <Card title="Ringkasan operasional" sub="Angka agregat backend" icon={Truck}>
              <dl className="space-y-1 text-sm">
                {Object.entries(d)
                  .filter(([, v]) => typeof v === 'number')
                  .slice(0, 14)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <dt className="text-slate-500">{k.replace(/_/g, ' ')}</dt>
                      <dd className="font-bold tabular-nums">{formatCurrency(v as number)}</dd>
                    </div>
                  ))}
              </dl>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ── SDM ──────────────────────────────────────────────────────────
interface KasbonRow {
  nomor_kasbon: string;
  karyawan_nama?: string;
  nominal: number;
  jumlah_bayar: number;
  tanggal?: string;
}

interface SlipRow {
  id: number;
  karyawan_nama?: string;
  periode_tahun?: number;
  periode_minggu?: number;
  total_diterima?: number;
  status?: string;
}

export function Sdm() {
  const today = todayISO();
  const absensi = useQuery({ queryKey: ['absensi', today], queryFn: () => domainService.absensiToday(today) });
  const kasbon = useQuery({ queryKey: ['kasbon_out'], queryFn: domainService.kasbonOutstanding });
  const now = new Date();
  const slip = useQuery({
    queryKey: ['slip', now.getFullYear()],
    queryFn: () => domainService.slipGajiStatus({ limit: 50, periode_tahun: now.getFullYear() }),
  });

  const daily = (absensi.data ?? {}) as { summary?: Record<string, number> };
  const krows = ((((kasbon.data ?? {}) as Row).data ?? kasbon.data ?? []) as Row[]).map(
    (k): KasbonRow => ({
      nomor_kasbon: str(k.nomor_kasbon),
      karyawan_nama: str(k.karyawan_nama),
      nominal: num(k.nominal),
      jumlah_bayar: num(k.jumlah_bayar),
      tanggal: str(k.tanggal),
    }),
  );
  const srows = ((((slip.data ?? {}) as Row).data ?? slip.data ?? []) as Row[]).map(
    (s): SlipRow => ({
      id: num(s.id),
      karyawan_nama: str(s.karyawan_nama),
      periode_tahun: s.periode_tahun as number | undefined,
      periode_minggu: s.periode_minggu as number | undefined,
      total_diterima: num(s.total_diterima ?? s.total),
      status: str(s.status),
    }),
  );
  const paidCount = srows.filter((s) => s.status === 'LUNAS').length;
  const kasbonTotal = krows.reduce((a, k) => a + (k.nominal - k.jumlah_bayar), 0);
  const hadir = num(daily.summary?.hadir ?? daily.summary?.HADIR);

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="SDM" sub={`Absensi, kasbon & slip gaji · ${today}`} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Hadir hari ini" value={str(hadir || '-')} sub={`${Object.values(daily.summary ?? {}).reduce((a, v) => a + num(v), 0)} tercatat`} icon={CalendarCheck2} tone="green" />
        <Stat label="Kasbon outstanding" value={formatCurrency(kasbonTotal)} sub={`${krows.length} belum lunas`} icon={HandCoins} tone="red" />
        <Stat label="Slip lunas" value={`${paidCount}/${srows.length}`} sub={`Tahun ${now.getFullYear()}`} icon={ReceiptText} tone="indigo" />
        <Stat label="Karyawan" value={str(krows.length > 0 || srows.length > 0 ? 'Aktif' : '-')} sub="Terdata di sistem" icon={Users} tone="navy" />
      </div>
      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <Card title="Absensi hari ini" sub={today} icon={CalendarCheck2}>
            {absensi.isLoading ? (
              <Loading />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(daily.summary ?? {}).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k.replace(/_/g, ' ')}</p>
                    <p className="text-xl font-extrabold tabular-nums">{v}</p>
                  </div>
                ))}
                {Object.keys(daily.summary ?? {}).length === 0 && <Empty text="Belum ada data absensi." />}
              </div>
            )}
          </Card>
        </div>
        <div className="xl:col-span-3">
          <Card
            title="Slip gaji berjalan"
            sub={`${paidCount}/${srows.length} lunas`}
            icon={ReceiptText}
            right={<Badge tone={paidCount === srows.length && srows.length > 0 ? 'ok' : 'warn'}>{paidCount}/{srows.length}</Badge>}
          >
            {slip.isLoading ? (
              <Loading />
            ) : srows.length === 0 ? (
              <Empty text="Belum ada slip tahun ini." />
            ) : (
              <ul className="max-h-72 divide-y divide-slate-50 overflow-y-auto">
                {srows.slice(0, 20).map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-extrabold text-indigo-600">
                      {(s.karyawan_nama ?? '?').slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{s.karyawan_nama}</p>
                      <p className="text-xs text-slate-400">Minggu {s.periode_minggu}/{s.periode_tahun}</p>
                    </div>
                    <span className="text-xs tabular-nums text-slate-500">{formatCurrency(s.total_diterima)}</span>
                    <Badge tone={s.status === 'LUNAS' ? 'ok' : 'warn'}>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <Card
        title={`Kasbon outstanding (${krows.length})`}
        sub={`Total ${formatCurrency(kasbonTotal)}`}
        icon={HandCoins}
        right={krows.length > 0 ? exportBtn(() => downloadCSV('kasbon.csv', ['Nomor', 'Karyawan', 'Tanggal', 'Nominal', 'Dibayar', 'Sisa'], krows.map((k) => [k.nomor_kasbon, k.karyawan_nama ?? '-', k.tanggal ?? '-', k.nominal, k.jumlah_bayar, k.nominal - k.jumlah_bayar]))) : undefined}
      >
        {kasbon.isLoading ? (
          <Loading />
        ) : krows.length === 0 ? (
          <Empty text="Tidak ada kasbon outstanding." />
        ) : (
          <DataTable
            headers={['Nomor', 'Karyawan', 'Tanggal', 'Nominal', 'Dibayar', 'Sisa']}
            rightAlignFrom={3}
            rows={krows.map((k) => [
              <span key="n" className="font-mono text-xs font-bold">{k.nomor_kasbon}</span>,
              <span key="k" className="font-medium">{k.karyawan_nama}</span>,
              <span key="t" className="text-xs text-slate-400">{(k.tanggal ?? '-').slice(0, 10)}</span>,
              <span key="a" className="tabular-nums">{formatCurrency(k.nominal)}</span>,
              <span key="b" className="tabular-nums text-slate-500">{formatCurrency(k.jumlah_bayar)}</span>,
              <span key="s" className="font-extrabold tabular-nums text-rose-600">{formatCurrency(k.nominal - k.jumlah_bayar)}</span>,
            ])}
          />
        )}
      </Card>
    </div>
  );
}
