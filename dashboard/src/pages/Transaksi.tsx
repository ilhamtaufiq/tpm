import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Download, Search } from 'lucide-react';
import { financeService } from '../api/services';
import { downloadCSV } from './Domains';
import { formatCurrency, formatDateTime } from '../utils/format';
import { Badge, Card, DataTable, Loading, PageHeader, Stat } from '../components/ui';

interface KasRow {
  id: number;
  nomor_transaksi: string;
  tanggal: string;
  tipe: string;
  sumber: string;
  nominal: number;
  keterangan?: string;
}

const SUMBER_META: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' }> = {
  BENGKEL: { label: 'Bengkel', tone: 'info' },
  JUAL_BELI_MOBIL: { label: 'Mobil', tone: 'warn' },
  JASA_ANGKUT: { label: 'Angkut', tone: 'ok' },
  PIUTANG: { label: 'Piutang', tone: 'info' },
  HUTANG: { label: 'Hutang', tone: 'bad' },
  MODAL: { label: 'Modal', tone: 'ok' },
  PRIVE: { label: 'Prive', tone: 'bad' },
  GAJI: { label: 'Gaji', tone: 'bad' },
};

export default function Transaksi() {
  const [sumber, setSumber] = useState('');
  const [tipe, setTipe] = useState('');
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['kas_bank_list', sumber, tipe],
    queryFn: () =>
      financeService.kasBankList({
        limit: 100,
        sort_by: 'created_at',
        sort_order: 'desc',
        ...(sumber ? { sumber } : {}),
        ...(tipe ? { tipe } : {}),
      }),
  });

  const all = ((q.data as { data?: KasRow[] } | undefined)?.data ?? []) as KasRow[];
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return all;
    return all.filter((r) =>
      [r.nomor_transaksi, r.keterangan, r.sumber].some((v) => String(v ?? '').toLowerCase().includes(s)),
    );
  }, [all, search]);

  const masuk = rows.filter((r) => r.tipe === 'MASUK').reduce((a, r) => a + r.nominal, 0);
  const keluar = rows.filter((r) => r.tipe === 'KELUAR').reduce((a, r) => a + r.nominal, 0);

  const selectCls =
    'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400';

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Transaksi"
        sub="Arus kas & bank lintas domain · real-time"
        right={
          rows.length > 0 ? (
            <button
              onClick={() =>
                downloadCSV(
                  'transaksi.csv',
                  ['Waktu', 'Referensi', 'Sumber', 'Tipe', 'Nominal', 'Keterangan'],
                  rows.map((r) => [r.tanggal, r.nomor_transaksi, r.sumber, r.tipe, r.nominal, r.keterangan ?? '']),
                )
              }
              className="flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#14305a]"
            >
              <Download size={15} /> Export CSV
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Masuk" value={formatCurrency(masuk)} icon={ArrowUpRight} tone="green" />
        <Stat label="Keluar" value={formatCurrency(keluar)} icon={ArrowDownLeft} tone="red" />
        <Stat label="Net" value={formatCurrency(masuk - keluar)} icon={ArrowLeftRight} tone={masuk - keluar >= 0 ? 'green' : 'red'} />
      </div>

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-50 px-5 py-3.5">
          <span className="relative flex-1 min-w-[180px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari referensi / keterangan…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
            />
          </span>
          <select value={sumber} onChange={(e) => setSumber(e.target.value)} className={selectCls}>
            <option value="">Semua domain</option>
            <option value="BENGKEL">Bengkel</option>
            <option value="JUAL_BELI_MOBIL">Mobil</option>
            <option value="JASA_ANGKUT">Angkut</option>
            <option value="PIUTANG">Piutang</option>
            <option value="HUTANG">Hutang</option>
            <option value="MODAL">Modal</option>
            <option value="GAJI">Gaji</option>
          </select>
          <select value={tipe} onChange={(e) => setTipe(e.target.value)} className={selectCls}>
            <option value="">Masuk + Keluar</option>
            <option value="MASUK">Masuk</option>
            <option value="KELUAR">Keluar</option>
          </select>
        </div>
        <div className="p-5 pt-3">
          {q.isLoading ? (
            <Loading />
          ) : (
            <DataTable
              headers={['Waktu', 'Referensi', 'Sumber', 'Keterangan', 'Nominal']}
              empty="Tidak ada transaksi pada filter ini."
              rightAlignFrom={4}
              rows={rows.map((r) => [
                <span key="t" className="whitespace-nowrap text-xs text-slate-400">{formatDateTime(r.tanggal)}</span>,
                <span key="n" className="font-mono text-xs font-bold text-slate-700">{r.nomor_transaksi}</span>,
                <span key="s">
                  <Badge tone={SUMBER_META[r.sumber]?.tone ?? 'info'}>{SUMBER_META[r.sumber]?.label ?? r.sumber}</Badge>
                </span>,
                <span key="k" className="block max-w-[280px] truncate text-slate-600">{r.keterangan ?? '-'}</span>,
                <span key="v" className={`flex items-center justify-end gap-1 font-mono font-extrabold ${r.tipe === 'MASUK' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {r.tipe === 'MASUK' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                  {formatCurrency(r.nominal)}
                </span>,
              ])}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
