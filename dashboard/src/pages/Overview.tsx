import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BellRing,
  Car,
  CheckCircle2,
  Truck,
  Wallet,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useActivity, useAlerts, useSummary } from '../hooks/useDashboard';
import { formatCurrency, formatDateTime } from '../utils/format';
import { Badge, Card, Empty, Loading, PageHeader, ProgressBar, Stat } from '../components/ui';

interface SummaryShape {
  bengkel?: { laba_kotor?: number; laba_bersih?: number; total_transaksi?: number };
  mobil?: { laba_tpm?: number; laba_bersih?: number; total_transaksi?: number };
  jasa_angkut?: { laba_tpm?: number; laba_bersih?: number; total_transaksi?: number };
  piutang?: { total_sisa?: number; jumlah_overdue?: number };
  hutang?: { total_sisa?: number };
  laba_bersih?: number;
  laba_operasional?: number;
}

interface ActivityShape {
  id: string;
  title: string;
  subtitle?: string;
  amount?: number;
  is_incoming?: boolean;
  timestamp: string;
  source?: string;
}

const BAR_COLORS = ['#4F46E5', '#F59E0B', '#10B981'];

export default function Overview() {
  const summary = useSummary();
  const activity = useActivity(15);
  const alerts = useAlerts();

  if (summary.isLoading) return <Loading />;
  if (summary.isError) return <Empty text="Gagal memuat ringkasan. Periksa koneksi backend." />;

  const s = (summary.data ?? {}) as SummaryShape;
  const labaBersih = s.laba_bersih ?? 0;
  const trend = [
    { domain: 'Bengkel', laba: s.bengkel?.laba_bersih ?? s.bengkel?.laba_kotor ?? 0 },
    { domain: 'Mobil', laba: s.mobil?.laba_bersih ?? s.mobil?.laba_tpm ?? 0 },
    { domain: 'Angkut', laba: s.jasa_angkut?.laba_bersih ?? s.jasa_angkut?.laba_tpm ?? 0 },
  ];
  const maxLaba = Math.max(1, ...trend.map((t) => Math.abs(t.laba)));
  const overdue = (alerts.data?.overdue ?? []) as unknown[];
  const cashUsers = (alerts.data?.cashUsers ?? []) as { cash_balance?: number }[];
  const lowStock = (alerts.data?.lowStock ?? []) as unknown[];
  const openCash = cashUsers.filter((u) => (u.cash_balance ?? 0) > 0);
  const alertCount = overdue.length + openCash.length + lowStock.length;
  const feed = ((activity.data ?? []) as ActivityShape[]).slice(0, 12);

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Overview"
        sub="Ringkasan operasional & keuangan bulan berjalan"
        right={
          <Badge tone={alertCount > 0 ? 'bad' : 'ok'}>
            <BellRing size={13} /> {alertCount > 0 ? `${alertCount} perlu perhatian` : 'Semua aman'}
          </Badge>
        }
      />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0B1F3A] p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Laba bersih bulan ini</p>
            <p className={`mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl ${labaBersih < 0 ? 'text-rose-300' : 'text-white'}`}>
              {formatCurrency(labaBersih)}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Operasional {formatCurrency(s.laba_operasional)} ·{' '}
              <span className={labaBersih >= 0 ? 'font-bold text-emerald-300' : 'font-bold text-rose-300'}>
                {labaBersih >= 0 ? 'PROFIT' : 'LOSS'}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/laba-rugi" className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/20">
              Lihat Laba Rugi
            </Link>
            <Link to="/transaksi" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#0B1F3A] hover:bg-slate-100">
              Transaksi
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Stat label="Bengkel" value={formatCurrency(s.bengkel?.laba_kotor)} sub={`${s.bengkel?.total_transaksi ?? 0} transaksi`} icon={Wrench} tone="indigo" />
        <Stat label="Mobil (TPM)" value={formatCurrency(s.mobil?.laba_tpm)} sub={`${s.mobil?.total_transaksi ?? 0} transaksi`} icon={Car} tone="amber" />
        <Stat label="Angkut (TPM)" value={formatCurrency(s.jasa_angkut?.laba_tpm)} sub={`${s.jasa_angkut?.total_transaksi ?? 0} trip`} icon={Truck} tone="green" />
        <Stat label="Piutang sisa" value={formatCurrency(s.piutang?.total_sisa)} sub={`${s.piutang?.jumlah_overdue ?? 0} overdue`} icon={ArrowUpRight} tone="red" />
        <Stat label="Hutang sisa" value={formatCurrency(s.hutang?.total_sisa)} sub="Kewajiban usaha" icon={ArrowDownLeft} tone="navy" />
        <Stat label="Kas di kasir" value={formatCurrency(openCash.reduce((a, u) => a + (u.cash_balance ?? 0), 0))} sub={`${openCash.length} kasir pegang saldo`} icon={Wallet} tone="amber" />
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        {/* Chart */}
        <div className="xl:col-span-3">
          <Card title="Laba per unit bisnis" sub="Bulan berjalan · klik bar untuk detail" icon={Activity}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="domain" width={70} tick={{ fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => formatCurrency(v as number)}
                    contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <Bar dataKey="laba" radius={[0, 8, 8, 0]} barSize={26}>
                    {trend.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2.5">
              {trend.map((t, i) => (
                <div key={t.domain}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-bold text-slate-600">{t.domain}</span>
                    <span className={`font-bold ${t.laba < 0 ? 'text-rose-600' : 'text-slate-800'}`}>{formatCurrency(t.laba)}</span>
                  </div>
                  <ProgressBar value={(Math.abs(t.laba) / maxLaba) * 100} tone={(['indigo', 'amber', 'emerald'] as const)[i % 3]} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Alerts */}
        <div className="xl:col-span-2">
          <Card
            title="Perlu perhatian"
            sub="Alert operasional & keuangan"
            icon={BellRing}
            right={<Badge tone={alertCount > 0 ? 'bad' : 'ok'}>{alertCount}</Badge>}
          >
            {alertCount === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                  <CheckCircle2 size={24} />
                </span>
                <p className="text-sm font-medium text-slate-500">Semua aman. Tidak ada alert.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {overdue.length > 0 && (
                  <li>
                    <Link to="/hutang-piutang" className="flex items-start gap-3 rounded-xl bg-rose-50 p-3 transition hover:bg-rose-100/70">
                      <AlertTriangle size={17} className="mt-0.5 shrink-0 text-rose-500" />
                      <span className="text-sm">
                        <b className="text-rose-700">{overdue.length} piutang overdue</b>
                        <span className="block text-xs text-rose-500">Lewat jatuh tempo — segera tindak lanjuti →</span>
                      </span>
                    </Link>
                  </li>
                )}
                {lowStock.length > 0 && (
                  <li>
                    <Link to="/stok" className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 transition hover:bg-amber-100/70">
                      <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-500" />
                      <span className="text-sm">
                        <b className="text-amber-700">{lowStock.length} sparepart menipis</b>
                        <span className="block text-xs text-amber-600">Stok di bawah minimum / habis →</span>
                      </span>
                    </Link>
                  </li>
                )}
                {openCash.length > 0 && (
                  <li className="flex items-start gap-3 rounded-xl bg-indigo-50 p-3">
                    <Wallet size={17} className="mt-0.5 shrink-0 text-indigo-500" />
                    <span className="text-sm">
                      <b className="text-indigo-700">{openCash.length} kasir pegang saldo</b>
                      <span className="block text-xs text-indigo-500">
                        Total {formatCurrency(openCash.reduce((a, u) => a + (u.cash_balance ?? 0), 0))} belum disetor
                      </span>
                    </span>
                  </li>
                )}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Feed */}
      <Card
        title="Arus transaksi terbaru"
        sub="Diperbarui otomatis via WebSocket"
        icon={Activity}
        right={
          <Link to="/transaksi" className="text-xs font-bold text-indigo-600 hover:underline">
            Lihat semua →
          </Link>
        }
      >
        {activity.isLoading ? (
          <p className="py-6 text-center text-sm text-slate-400">Memuat…</p>
        ) : feed.length === 0 ? (
          <Empty text="Belum ada aktivitas." />
        ) : (
          <ul className="divide-y divide-slate-50">
            {feed.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.is_incoming ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {a.is_incoming ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{a.title}</p>
                  <p className="truncate text-xs text-slate-400">{a.subtitle} · {formatDateTime(a.timestamp)}</p>
                </div>
                <span className={`shrink-0 font-mono text-sm font-extrabold ${a.is_incoming ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {a.is_incoming ? '+' : '−'}{formatCurrency(a.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Mini trend (area) */}
      <Card title="Komposisi laba" sub="Proporsi kontribusi tiap unit" icon={Activity} pad={true}>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="domain" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="laba" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.15} strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
