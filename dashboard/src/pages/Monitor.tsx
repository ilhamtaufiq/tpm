import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Database, RefreshCw, Server, ShieldCheck, Zap } from 'lucide-react';
import { monitorService } from '../api/services';
import { Card, Loading, PageHeader, ProgressBar, Stat } from '../components/ui';

interface TableStat {
  name: string;
  rows: number;
}

interface MonitorStats {
  database?: {
    total_size_mb?: number;
    table_count?: number;
    tables?: TableStat[];
  };
  system?: Record<string, unknown>;
}

export default function Monitor() {
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'system' | 'database'>('system');

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const data = await monitorService.stats();
      setStats(data);
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
  const maxRows = Math.max(...tables.map((t) => t.rows), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System & Log Monitor"
        sub="Monitoring performa database, beban server, dan kesehatan sistem real-time."
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Ukuran DB"
          value={`${db?.total_size_mb || '0.0'} MB`}
          sub="Total kapasitas PostgreSQL"
          icon={Database}
          tone="indigo"
        />
        <Stat
          label="Total Tabel"
          value={String(db?.table_count || 0)}
          sub="Tabel aktif di skema DB"
          icon={Server}
          tone="green"
        />
        <Stat
          label="Status Server"
          value="HEALTHY"
          sub="FastAPI + PostgreSQL"
          icon={ShieldCheck}
          tone="green"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
            activeTab === 'system'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Activity size={15} />
          Informasi Tabel & Baris DB
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
          Distribusi Data Database
        </button>
      </div>

      {/* Content */}
      {activeTab === 'system' ? (
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
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 font-mono text-xs text-slate-700">
            <p>Database Engine: PostgreSQL (SQLAlchemy Async ORM)</p>
            <p>Connected Service: TPM Core API v1</p>
            <p>Total Managed Tables: {tables.length}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
