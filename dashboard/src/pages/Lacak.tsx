import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { financeService } from '../api/services';
import { formatCurrency, formatDateTime } from '../utils/format';
import { Badge, Card, DataTable, Loading, PageHeader } from '../components/ui';

type Found = { kind: 'KAS' | 'PTG' | 'HTG'; doc: Record<string, unknown>; payments: Record<string, unknown>[] };

async function lookup(nomor: string): Promise<Found | null> {
  const key = nomor.trim().toUpperCase();
  if (!key) return null;
  if (key.startsWith('PTG')) {
    const r = await financeService.piutangSearch(key);
    const doc = r.data?.[0];
    if (!doc || String(doc.nomor_piutang ?? '').toUpperCase() !== key) return null;
    const payments = (doc.pembayaran as Record<string, unknown>[] | undefined) ?? (await financeService.piutangPayments(Number(doc.id)).catch(() => []));
    return { kind: 'PTG', doc, payments };
  }
  if (key.startsWith('HTG')) {
    const r = await financeService.hutangSearch(key);
    const doc = r.data?.[0];
    if (!doc || String(doc.nomor_hutang ?? '').toUpperCase() !== key) return null;
    const payments = (doc.pembayaran as Record<string, unknown>[] | undefined) ?? (await financeService.hutangPayments(Number(doc.id)).catch(() => []));
    return { kind: 'HTG', doc, payments };
  }
  if (key.startsWith('KAS')) {
    const doc = await financeService.kasBankByNomor(key).catch(() => null);
    if (!doc) return null;
    return { kind: 'KAS', doc, payments: [] };
  }
  return null;
}

const KIND_META = {
  KAS: { label: 'Kas/Bank', tone: 'info' as const },
  PTG: { label: 'Piutang', tone: 'warn' as const },
  HTG: { label: 'Hutang', tone: 'bad' as const },
};

export default function Lacak() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('nomor') ?? '';
  const [input, setInput] = useState(initial);
  const nomor = initial.trim().toUpperCase();
  const q = useQuery({
    queryKey: ['lacak', nomor],
    queryFn: () => lookup(nomor),
    enabled: nomor.length > 0,
    staleTime: 30_000,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams(input.trim() ? { nomor: input.trim().toUpperCase() } : {});
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="Lacak Nomor" sub="KAS · PTG · HTG — detail + mutasi pembayaran" />
      <Card>
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Contoh: KAS2609060004 / PTG2609060001 / HTG2609060001"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm uppercase outline-none focus:border-indigo-400 focus:bg-white"
          />
          <button type="submit" className="shrink-0 rounded-xl bg-[#0B1F3A] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#14305a]">
            Lacak
          </button>
        </form>
      </Card>
      {!nomor ? (
        <Card><p className="py-6 text-center text-sm text-slate-400">Masukkan nomor dokumen untuk melihat rincian.</p></Card>
      ) : q.isLoading ? (
        <Loading text="Mencari dokumen…" />
      ) : q.isError || !q.data ? (
        <Card><p className="py-6 text-center text-sm text-rose-500">Nomor {nomor} tidak ditemukan.</p></Card>
      ) : (
        <DocDetail found={q.data} />
      )}
    </div>
  );
}

function DocDetail({ found }: { found: Found }) {
  const { kind, doc, payments } = found;
  const meta = KIND_META[kind];
  const item = (k: string, v: React.ReactNode) => (
    <div key={k} className="flex items-start justify-between gap-4 border-b border-slate-50 py-2 text-sm last:border-0">
      <span className="shrink-0 font-bold capitalize text-slate-400">{k.replace(/_/g, ' ')}</span>
      <span className="text-right font-medium text-slate-700">{v}</span>
    </div>
  );
  const numKey = kind === 'KAS' ? 'nomor_transaksi' : kind === 'PTG' ? 'nomor_piutang' : 'nomor_hutang';
  return (
    <div className="space-y-5">
      <Card title={String(doc[numKey] ?? '-')} sub={meta.label} right={<Badge tone={meta.tone}>{meta.label}</Badge>}>
        {kind === 'KAS' ? (
          <div>
            {item('tanggal', formatDateTime(String(doc.tanggal ?? '-')))}
            {item('tipe', String(doc.tipe ?? '-'))}
            {item('sumber', String(doc.sumber ?? '-'))}
            {item('jenis', String(doc.jenis ?? '-'))}
            {item('nominal', <span className="font-mono font-extrabold">{formatCurrency(Number(doc.nominal ?? 0))}</span>)}
            {item('referensi', String(doc.nomor_referensi ?? '-'))}
            {item('keterangan', String(doc.keterangan ?? '-'))}
          </div>
        ) : (
          <div>
            {item('tanggal', formatDateTime(String(doc.tanggal ?? '-')))}
            {item(kind === 'PTG' ? 'debitur' : 'kreditur', String(doc.nama_debitur ?? doc.nama_kreditur ?? '-'))}
            {item('nominal', <span className="font-mono font-extrabold">{formatCurrency(Number(doc.nominal_piutang ?? doc.nominal_hutang ?? 0))}</span>)}
            {item('dibayar', formatCurrency(Number(doc.total_dibayar ?? 0)))}
            {item('sisa', <span className="font-mono font-extrabold">{formatCurrency(Number(doc.sisa_piutang ?? doc.sisa_hutang ?? 0))}</span>)}
            {item('status', String(doc.status ?? '-'))}
            {item('jatuh tempo', String(doc.tanggal_jatuh_tempo ?? '-'))}
          </div>
        )}
      </Card>
      {kind !== 'KAS' && (
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
