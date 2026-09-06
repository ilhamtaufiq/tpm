import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

// ── Design tokens ──────────────────────────────────────────────
// Navy #0B1F3A dark surfaces · slate text · emerald profit · rose loss ·
// amber warn · indigo info. Fonts: Display heading, Text body, Code angka.
export const tones = {
  navy: 'bg-[#0B1F3A]',
  profit: 'text-emerald-600',
  loss: 'text-rose-600',
} as const;

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({
  title,
  sub,
  icon: Icon,
  children,
  right,
  pad = true,
}: {
  title?: string;
  sub?: string;
  icon?: LucideIcon;
  children: ReactNode;
  right?: ReactNode;
  pad?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-50 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon size={16} />
              </span>
            )}
            <div>
              {title && <h2 className="text-sm font-bold text-slate-800">{title}</h2>}
              {sub && <p className="text-xs text-slate-400">{sub}</p>}
            </div>
          </div>
          {right}
        </div>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'navy',
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  tone?: 'navy' | 'green' | 'red' | 'amber' | 'indigo';
  trend?: 'up' | 'down';
}) {
  const bar = {
    navy: 'bg-[#0B1F3A]',
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
    amber: 'bg-amber-500',
    indigo: 'bg-indigo-500',
  }[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 truncate font-mono text-lg font-extrabold tracking-tight text-slate-900">{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>}
        </div>
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
            <Icon size={17} />
          </span>
        )}
      </div>
      {trend && (
        <span className={`mt-2 inline-block pl-2 text-xs font-bold ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend === 'up' ? '▲ Naik' : '▼ Turun'}
        </span>
      )}
    </div>
  );
}

// Back-compat alias (Overview lama).
export const Kpi = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <Stat label={label} value={value} sub={sub} />
);

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  const tones = {
    ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warn: 'bg-amber-50 text-amber-700 ring-amber-200',
    bad: 'bg-rose-50 text-rose-700 ring-rose-200',
    info: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Empty({ text, icon: Icon }: { text: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
          <Icon size={22} />
        </span>
      )}
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

export function Loading({ text = 'Memuat data…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

// Paginasi client-side: kontrol hanya muncul saat baris > PAGE_SIZE.
export const PAGE_SIZE = 20;

export function usePagination(length: number) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(length / PAGE_SIZE);
  useEffect(() => setPage(0), [length]);
  useEffect(() => {
    if (page >= pages) setPage(Math.max(0, pages - 1));
  }, [page, pages]);
  return { page, pages, setPage };
}

export function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const btn = 'rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40';
  return (
    <div className="flex items-center justify-between gap-2 px-1 py-2.5 text-xs text-slate-500">
      <span className="font-mono tabular-nums">
        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} dari {total} · hal {page + 1}/{pages}
      </span>
      <div className="flex items-center gap-1">
        <button aria-label="Halaman pertama" disabled={page === 0} onClick={() => onPage(0)} className={btn}>«</button>
        <button aria-label="Halaman sebelumnya" disabled={page === 0} onClick={() => onPage(page - 1)} className={btn}>‹</button>
        <button aria-label="Halaman berikutnya" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} className={btn}>›</button>
        <button aria-label="Halaman terakhir" disabled={page >= pages - 1} onClick={() => onPage(pages - 1)} className={btn}>»</button>
      </div>
    </div>
  );
}

export function DataTable({
  headers,
  rows,
  empty,
  rightAlignFrom = 99,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty?: string;
  rightAlignFrom?: number;
}) {
  const { page, pages, setPage } = usePagination(rows.length);
  if (rows.length === 0) return <Empty text={empty ?? 'Tidak ada data.'} />;
  const visible = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  return (
    <div>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400">
              {headers.map((h, i) => (
                <th key={i} className={`px-2 py-2 font-bold ${i >= rightAlignFrom ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={page * PAGE_SIZE + i} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/70">
                {r.map((c, j) => (
                  <td key={j} className={`px-2 py-2.5 ${j >= rightAlignFrom ? 'text-right' : ''}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} total={rows.length} onPage={setPage} />
    </div>
  );
}

export function ProgressBar({ value, tone = 'emerald' }: { value: number; tone?: 'emerald' | 'rose' | 'amber' | 'indigo' }) {
  const pct = Math.min(100, Math.max(0, value));
  const bg = { emerald: 'bg-emerald-500', rose: 'bg-rose-500', amber: 'bg-amber-500', indigo: 'bg-indigo-500' }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
