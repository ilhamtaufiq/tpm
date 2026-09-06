import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Download } from 'lucide-react';
import { financeService } from '../api/services';
import { downloadCSV } from './Domains';
import { formatCurrency } from '../utils/format';
import { Badge, Card, DataTable, Empty, Loading, PageHeader, Stat } from '../components/ui';
import { Drill, kasJenisLabel } from '../components/reports';
import { drillKasJenis } from '../components/drills';

type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0);
const str = (v: unknown, fb = '-') => (v === null || v === undefined || v === '' ? fb : String(v));

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthISO = (d: Date) => d.toISOString().slice(0, 7);

const periodRange = (mode: 'harian' | 'bulanan' | 'tahunan', val: string) => {
  if (mode === 'harian') return { dari: val, sampai: val };
  if (mode === 'tahunan') return { dari: `${val}-01-01`, sampai: `${val}-12-31` };
  const [y, m] = val.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { dari: `${val}-01`, sampai: `${val}-${last}` };
};

export default function Kas() {
  const [mode, setMode] = useState<'harian' | 'bulanan' | 'tahunan'>('bulanan');
  const [pval, setPval] = useState(() => monthISO(new Date()));
  const [jenis, setJenis] = useState('');
  const { dari, sampai } = periodRange(mode, pval);

  const pickPeriod = (m: 'harian' | 'bulanan' | 'tahunan') => {
    setMode(m);
    const now = new Date();
    setPval(m === 'harian' ? todayISO() : m === 'tahunan' ? String(now.getFullYear()) : monthISO(now));
  };

  const balances = useQuery({ queryKey: ['kas_balances'], queryFn: financeService.kasBankBalances });
  const mutasi = useQuery({
    queryKey: ['kas_mutasi', mode, pval, jenis],
    queryFn: () =>
      financeService.kasBankList({
        tanggal_dari: dari,
        tanggal_sampai: sampai,
        limit: 100,
        sort_by: 'tanggal',
        sort_order: 'desc',
        ...(jenis ? { jenis } : {}),
      }),
  });

  const b = (balances.data ?? {}) as Row;
  const accounts = useMemo(() => {
    const skip = new Set(['total_saldo']);
    return Object.entries(b)
      .filter(([k, v]) => !skip.has(k) && v !== null && typeof v === 'object')
      .map(([k, v]) => {
        const o = v as Row;
        return {
          jenis: String(o.jenis ?? k).toUpperCase(),
          saldo: num(o.saldo),
          masuk: num(o.total_masuk),
          keluar: num(o.total_keluar),
        };
      })
      .filter((a) => a.saldo !== 0 || a.masuk !== 0 || a.keluar !== 0);
  }, [b]);

  const totalSaldo = accounts.reduce((a, r) => a + r.saldo, 0);
  const rows = (((mutasi.data as { data?: Row[] } | undefined)?.data ?? []) as Row[]).map((r) => ({
    tanggal: str(r.tanggal).slice(0, 10),
    referensi: str(r.nomor_transaksi ?? r.nomor_referensi),
    akun: kasJenisLabel(str(r.jenis)),
    tipe: str(r.tipe),
    keterangan: str(r.keterangan),
    nominal: num(r.nominal),
    key: str(r.id ?? r.nomor_transaksi),
  }));
  const masuk = rows.filter((r) => r.tipe === 'MASUK').reduce((a, r) => a + r.nominal, 0);
  const keluar = rows.filter((r) => r.tipe === 'KELUAR').reduce((a, r) => a + r.nominal, 0);

  const selectCls =
    'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400';

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Kas per Akun"
        sub="Saldo & mutasi tiap akun keuangan"
        right={
          rows.length > 0 ? (
            <button
              onClick={() =>
                downloadCSV(
                  `kas-${pval}.csv`,
                  ['Tanggal', 'Referensi', 'Akun', 'Tipe', 'Keterangan', 'Nominal'],
                  rows.map((r) => [r.tanggal, r.referensi, r.akun, r.tipe, r.keterangan, r.nominal]),
                )
              }
              className="flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#14305a]"
            >
              <Download size={15} /> Export CSV
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Total saldo" value={formatCurrency(totalSaldo)} icon={Banknote} tone="navy" />
        <Stat label="Masuk periode" value={formatCurrency(masuk)} icon={Banknote} tone="ok" />
        <Stat label="Keluar periode" value={formatCurrency(keluar)} icon={Banknote} tone="red" />
        <Stat label="Net periode" value={formatCurrency(masuk - keluar)} icon={Banknote} tone="indigo" />
      </div>

      <Card title="Saldo per Akun" sub="Snapshot saat ini" icon={Banknote}>
        {balances.isLoading ? (
          <Loading />
        ) : accounts.length === 0 ? (
          <Empty text="Tidak ada saldo akun." icon={Banknote} />
        ) : (
          <div className="space-y-1">
            {accounts.map((a) => (
              <div key={a.jenis} className="rounded-xl border border-slate-100 px-3 py-2">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setJenis((j) => (j === a.jenis ? '' : a.jenis))}
                    className="text-left text-sm font-bold text-slate-700 hover:text-indigo-600"
                  >
                    {kasJenisLabel(a.jenis)}
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge tone={a.saldo < 0 ? 'bad' : 'ok'}>{formatCurrency(a.saldo)}</Badge>
                  </div>
                </div>
                <Drill
                  spec={drillKasJenis(a.jenis, kasJenisLabel(a.jenis))}
                  period={{ tanggal_dari: dari, tanggal_sampai: sampai }}
                  amountKey="signed"
                  total={0}
                  hideDiff
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title={`Mutasi ${pval}`}
        sub="Semua akun dalam periode"
        icon={Banknote}
        right={
          <div className="flex flex-wrap gap-2">
            <select value={mode} onChange={(e) => pickPeriod(e.target.value as 'harian' | 'bulanan' | 'tahunan')} className={selectCls}>
              <option value="harian">Harian</option>
              <option value="bulanan">Bulanan</option>
              <option value="tahunan">Tahunan</option>
            </select>
            {mode === 'harian' && <input type="date" value={pval} onChange={(e) => setPval(e.target.value)} className={selectCls} />}
            {mode === 'bulanan' && <input type="month" value={pval} onChange={(e) => setPval(e.target.value)} className={selectCls} />}
            {mode === 'tahunan' && <input type="number" value={pval} onChange={(e) => setPval(e.target.value)} className={selectCls} min={2020} max={2100} />}
            <select value={jenis} onChange={(e) => setJenis(e.target.value)} className={selectCls}>
              <option value="">Semua akun</option>
              {accounts.map((a) => (
                <option key={a.jenis} value={a.jenis}>
                  {kasJenisLabel(a.jenis)}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {mutasi.isLoading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="Tidak ada mutasi pada periode ini." icon={Banknote} />
        ) : (
          <DataTable
            headers={['Tanggal', 'Referensi', 'Akun', 'Tipe', 'Keterangan', 'Nominal']}
            rows={rows.map((r) => [r.tanggal, r.referensi, r.akun, r.tipe, r.keterangan, formatCurrency(r.nominal)])}
            rightAlignFrom={5}
          />
        )}
      </Card>
    </div>
  );
}
