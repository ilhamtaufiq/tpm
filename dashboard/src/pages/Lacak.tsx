import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { financeService, type LacakResult } from '../api/services';
import { formatCurrency, formatDateTime } from '../utils/format';
import { Badge, Card, DataTable, Loading, PageHeader } from '../components/ui';
import { kasJenisLabel } from '../components/reports';

const KIND_LABEL: Record<string, string> = {
  KAS: 'Kas/Bank',
  PTG: 'Piutang',
  HTG: 'Hutang',
  BGL: 'Penjualan Bengkel',
  MBL: 'Penjualan Mobil',
  JAS: 'Muatan Jasa Angkut',
  PGL: 'Pengeluaran',
  PBL: 'Pembelian Spare Part',
  GJI: 'Slip Gaji',
  KSB: 'Kasbon Karyawan',
  AST: 'Aset Tetap',
  KRY: 'Karyawan',
};

const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info'> = {
  KAS: 'info',
  PTG: 'warn',
  HTG: 'bad',
};

// Identitas dokumen sudah tampil sebagai judul kartu — jangan diulang.
const HIDDEN = new Set([
  'id', 'nomor_transaksi', 'nomor_piutang', 'nomor_hutang', 'nomor_slip', 'nomor_kasbon', 'kode',
]);
const MONEY = /(nominal|total|harga|jumlah|gaji|laba|hpp|subtotal|diskon|dp|sisa|saldo|biaya|pendapatan|bayar|tunjangan|potongan|residu)/i;

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}/.test(v);

function renderValue(key: string, raw: unknown): React.ReactNode {
  if (raw === null || raw === undefined || raw === '') return '-';
  const s = String(raw);
  if (MONEY.test(key) && s !== '' && !Number.isNaN(Number(s))) {
    return <span className="font-mono font-bold">{formatCurrency(Number(s))}</span>;
  }
  if (key === 'jenis') return kasJenisLabel(s);
  if (isDate(s)) return formatDateTime(s);
  return s.replace(/_/g, ' ');
}

export default function Lacak() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('nomor') ?? '';
  const [input, setInput] = useState(initial);
  const nomor = initial.trim();
  const q = useQuery({
    queryKey: ['lacak', nomor],
    queryFn: () => financeService.lacak(nomor),
    enabled: nomor.length > 0,
    staleTime: 30_000,
    retry: false,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams(input.trim() ? { nomor: input.trim() } : {});
  };

  const handleSelectNomor = (selectedNomor: string) => {
    setInput(selectedNomor);
    setParams({ nomor: selectedNomor });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="Lacak Nomor & Keterangan" sub="Cari berdasarkan nomor dokumen atau kata kunci keterangan" />
      <Card>
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Cari nomor (misal: BGL2609120001) atau keterangan (misal: ganti oli)..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm outline-none focus:border-indigo-400 focus:bg-white"
          />
          <button type="submit" className="shrink-0 rounded-xl bg-[#0B1F3A] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#14305a]">
            Cari
          </button>
        </form>
      </Card>
      {!nomor ? (
        <Card><p className="py-6 text-center text-sm text-slate-400">Masukkan nomor dokumen atau keterangan transaksi untuk melacak.</p></Card>
      ) : q.isLoading ? (
        <Loading text="Mencari data…" />
      ) : q.isError || !q.data ? (
        <Card>
          <p className="py-6 text-center text-sm text-rose-500">Pencarian "{nomor}" tidak ditemukan.</p>
        </Card>
      ) : q.data.kind === 'SEARCH' && q.data.results ? (
        <SearchResults results={q.data.results} onSelect={handleSelectNomor} />
      ) : (
        <DocDetail found={q.data} />
      )}
    </div>
  );
}

function SearchResults({ results, onSelect }: { results: NonNullable<LacakResult['results']>; onSelect: (nomor: string) => void }) {
  return (
    <Card title="Hasil Pencarian Keterangan" sub={`${results.length} dokumen ditemukan`}>
      <DataTable
        headers={['Nomor', 'Jenis', 'Tanggal', 'Keterangan', 'Nominal', 'Aksi']}
        empty="Tidak ada dokumen yang cocok."
        rightAlignFrom={4}
        rows={results.map((r, i) => [
          <button key={`n${i}`} onClick={() => onSelect(r.nomor)} className="font-mono font-bold text-indigo-600 hover:underline">
            {r.nomor}
          </button>,
          <Badge key={`b${i}`} tone={TONE[r.kind] ?? 'info'}>{KIND_LABEL[r.kind] ?? r.kind}</Badge>,
          <span key={`t${i}`}>{r.tanggal ? formatDateTime(r.tanggal) : '-'}</span>,
          <span key={`k${i}`} className="text-slate-700">{r.keterangan}</span>,
          <span key={`m${i}`} className="font-mono font-bold">{r.nominal ? formatCurrency(r.nominal) : '-'}</span>,
          <button
            key={`a${i}`}
            onClick={() => onSelect(r.nomor)}
            className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100"
          >
            Lihat Rincian
          </button>,
        ])}
      />
    </Card>
  );
}

function DocDetail({ found }: { found: LacakResult }) {
  const { kind, nomor, fields = {}, payments = [] } = found;
  const label = KIND_LABEL[kind] ?? kind;
  const rows = Object.entries(fields).filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== undefined && v !== '');

  return (
    <div className="space-y-5">
      <Card title={nomor} sub={label} right={<Badge tone={TONE[kind] ?? 'info'}>{kind}</Badge>}>
        <div>
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4 border-b border-slate-50 py-2 text-sm last:border-0">
              <span className="shrink-0 font-bold capitalize text-slate-400">{k.replace(/_/g, ' ')}</span>
              <span className="text-right font-medium text-slate-700">{renderValue(k, v)}</span>
            </div>
          ))}
        </div>
      </Card>
      {payments.length > 0 && (
        <Card title="Mutasi Pembayaran" sub={`${payments.length} pembayaran`}>
          <DataTable
            headers={['Tanggal', 'Jumlah', 'Metode', 'Keterangan']}
            empty="Belum ada pembayaran."
            rightAlignFrom={1}
            rows={payments.map((p, i) => [
              <span key={`t${i}`}>{formatDateTime(String(p.tanggal ?? p.created_at ?? '-'))}</span>,
              <span key={`n${i}`} className="font-mono font-bold">{formatCurrency(Number(p.jumlah_bayar ?? p.nominal ?? 0))}</span>,
              <span key={`m${i}`}>{String(p.metode ?? p.metode_pembayaran ?? '-')}</span>,
              <span key={`k${i}`} className="text-slate-500">{String(p.keterangan ?? p.catatan ?? '-')}</span>,
            ])}
          />
        </Card>
      )}
    </div>
  );
}
