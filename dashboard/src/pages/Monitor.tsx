import { useEffect, useState } from 'react';
import { Activity, AlertCircle, AlertTriangle, Bug, Database, RefreshCw, Server, Smartphone, Globe, Zap, Users } from 'lucide-react';
import { monitorService } from '../api/services';
import { Badge, Card, Empty, Loading, PageHeader, ProgressBar, Stat } from '../components/ui';

interface TableStat {
  name: string;
  rows: number;
}

interface ClientLog {
  id: string;
  type: 'LAG' | 'BUG' | 'ERROR';
  title: string;
  message: string;
  platform: 'android' | 'web' | 'ios';
  duration?: number;
  status?: number;
  stack?: string;
  url?: string;
  timestamp: number;
}

interface MonitorStats {
  database?: {
    total_size_mb?: number;
    table_count?: number;
    tables?: TableStat[];
  };
  client_logs?: ClientLog[];
  system?: Record<string, unknown>;
}

interface ActiveDevice {
  id: number;
  username: string;
  full_name: string;
  role: string;
  last_login: string | null;
  has_push_token: boolean;
  platform: 'mobile' | 'web';
}

export default function Monitor() {
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [devices, setDevices] = useState<ActiveDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'devices' | 'client-logs' | 'system' | 'database'>('devices');
  const [platformFilter, setPlatformFilter] = useState<'ALL' | 'ANDROID' | 'WEB'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LAG' | 'BUG' | 'ERROR'>('ALL');

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const [data, devs] = await Promise.all([
        monitorService.stats(),
        monitorService.activeDevices(),
      ]);
      setStats(data as MonitorStats);
      setDevices(devs);
    } catch (err) {
      console.error('[Dashboard Monitor] Failed to fetch stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <Loading text="Memuat data monitor sistem..." />;

  const db = stats?.database;
  const tables = db?.tables || [];
  const clientLogs = stats?.client_logs || [];
  const maxRows = Math.max(...tables.map((t) => t.rows), 1);

  const filteredLogs = clientLogs.filter((log) => {
    const matchPlatform =
      platformFilter === 'ALL' ||
      (platformFilter === 'ANDROID' && log.platform === 'android') ||
      (platformFilter === 'WEB' && log.platform === 'web');
    const matchType = typeFilter === 'ALL' || log.type === typeFilter;
    return matchPlatform && matchType;
  });

  const lagCount = clientLogs.filter((l) => l.type === 'LAG').length;
  const bugCount = clientLogs.filter((l) => l.type === 'BUG').length;
  const errCount = clientLogs.filter((l) => l.type === 'ERROR').length;
  const mobileCount = devices.filter((d) => d.platform === 'mobile').length;
  const webCount = devices.filter((d) => d.platform === 'web').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System & Log Monitor"
        sub="Monitoring real-time bug, error, lag dari build Android APK & Web Frontend."
        right={
          <button
            onClick={fetchStats}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Logs'}
          </button>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <Stat
          label="User Aktif"
          value={String(devices.length)}
          sub={`${mobileCount} mobile · ${webCount} web`}
          icon={Users}
          tone="green"
        />
        <Stat
          label="Mobile APK"
          value={String(mobileCount)}
          sub="Push token aktif"
          icon={Smartphone}
          tone="green"
        />
        <Stat
          label="Android & Web Logs"
          value={String(clientLogs.length)}
          sub="Total event terekam"
          icon={Activity}
          tone="indigo"
        />
        <Stat
          label="Lag & Delay"
          value={String(lagCount)}
          sub="Merespons > 1000ms"
          icon={Zap}
          tone="amber"
        />
        <Stat
          label="App Bugs"
          value={String(bugCount)}
          sub="Crash / ErrorBoundary"
          icon={Bug}
          tone="red"
        />
        <Stat
          label="HTTP Errors"
          value={String(errCount)}
          sub="Respon HTTP 4xx/5xx"
          icon={AlertCircle}
          tone="red"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('devices')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
            activeTab === 'devices'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Users size={15} />
          Active Devices ({devices.length})
        </button>
        <button
          onClick={() => setActiveTab('client-logs')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
            activeTab === 'client-logs'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Smartphone size={15} />
          Log Frontend (Android / Web) ({clientLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
            activeTab === 'system'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Server size={15} />
          Informasi Tabel DB
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
            activeTab === 'database'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Database size={15} />
          Spesifikasi Database
        </button>
      </div>

      {/* Content */}
      {activeTab === 'devices' ? (
        <Card
          title="Device Login Aktif"
          sub="Daftar user yang login beserta platform (Mobile APK / Web Dashboard)."
          icon={Users}
        >
          {devices.length === 0 ? (
            <Empty text="Belum ada data device login." icon={Users} />
          ) : (
            <div className="space-y-3">
              {devices.map((dev) => {
                const isMobile = dev.platform === 'mobile';
                const loginDate = dev.last_login
                  ? new Date(dev.last_login).toLocaleString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Belum pernah login';

                return (
                  <div
                    key={dev.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          isMobile ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                        }`}
                      >
                        {isMobile ? <Smartphone size={20} /> : <Globe size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{dev.full_name || dev.username}</p>
                        <p className="text-xs text-slate-500">
                          @{dev.username} · <span className="uppercase">{dev.role}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge tone={isMobile ? 'ok' : 'info'}>
                        {isMobile ? 'Mobile APK' : 'Web Only'}
                      </Badge>
                      <p className="mt-1 text-[11px] text-slate-400">{loginDate}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : activeTab === 'client-logs' ? (
        <Card
          title="Rekaman Audit Bug, Error, & Lag App"
          sub="Data real-time yang dikirim langsung dari aplikasi Android APK & Web Client."
          icon={Activity}
          right={
            <div className="flex flex-wrap items-center gap-2">
              {/* Platform Filters */}
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {(['ALL', 'ANDROID', 'WEB'] as const).map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setPlatformFilter(plat)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase transition-colors ${
                      platformFilter === plat
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>

              {/* Type Filters */}
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {(['ALL', 'LAG', 'BUG', 'ERROR'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase transition-colors ${
                      typeFilter === type
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {filteredLogs.length === 0 ? (
            <Empty text="Belum ada event log terekam dari Android/Web." icon={Activity} />
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const isAndroid = log.platform === 'android';
                const isLag = log.type === 'LAG';
                const isBug = log.type === 'BUG';
                const tone = isLag ? 'warn' : isBug ? 'bad' : 'info';
                const dateStr = new Date(log.timestamp * (log.timestamp < 10000000000 ? 1000 : 1)).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone={tone}>{log.type}</Badge>
                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                          {isAndroid ? <Smartphone size={13} className="text-emerald-600" /> : <Globe size={13} className="text-blue-600" />}
                          {isAndroid ? 'Android APK' : 'Web Version'}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-slate-400">{dateStr}</span>
                    </div>

                    <p className="mt-2 font-bold text-slate-900 text-sm">{log.title}</p>
                    <p className="mt-1 font-mono text-xs text-slate-600">{log.message}</p>

                    {log.duration ? (
                      <p className="mt-1 text-xs text-amber-600 font-semibold">
                        Delay: {log.duration}ms
                      </p>
                    ) : null}

                    {log.stack ? (
                      <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[10px] text-rose-300">
                        {log.stack}
                      </pre>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : activeTab === 'system' ? (
        <Card title="Distribusi Jumlah Baris per Tabel" sub="Data jumlah record aktif dalam database" icon={Zap}>
          <div className="space-y-4">
            {tables.map((table) => {
              const percent = Math.min(100, Math.round((table.rows / maxRows) * 100));
              return (
                <div key={table.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="font-mono text-slate-700">{table.name}</span>
                    <span className="text-slate-500">{table.rows.toLocaleString()} baris</span>
                  </div>
                  <ProgressBar value={percent} tone={percent > 80 ? 'indigo' : 'emerald'} />
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card title="Statistik Penyimpanan Skema" sub="Informasi arsitektur database backend" icon={AlertTriangle}>
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 font-mono text-xs text-slate-700 space-y-1">
            <p>Database Engine: PostgreSQL (SQLAlchemy Async ORM)</p>
            <p>Connected Service: TPM Core API v1</p>
            <p>Total Managed Tables: {tables.length}</p>
            <p>Client Event Ingestion: Active (Android & Web)</p>
          </div>
        </Card>
      )}
    </div>
  );
}
