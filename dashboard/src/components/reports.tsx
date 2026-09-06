import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PAGE_SIZE, Pager, usePagination } from './ui';
import { formatCurrency, formatCurrencyDisplay } from '../utils/format';
import type { KasArusJenis, KasJenisDetail } from '../types/reports';
import { drillService } from '../api/services';
import type { PeriodParams } from '../api/services';

// Port of frontend/components/ui/FinancialRow.tsx (web).
export function FinancialRow({
  label,
  value,
  bold,
  small,
  large,
  color,
  isNegative,
  indent,
}: {
  label: string;
  value: number;
  bold?: boolean;
  small?: boolean;
  large?: boolean;
  color?: string;
  isNegative?: boolean;
  indent?: boolean;
}) {
  const numeric = typeof value === 'number' ? value : Number(value) || 0;
  const neg = isNegative || numeric < 0;
  const textClass = color ?? (neg ? 'text-rose-600' : 'text-slate-800');
  return (
    <div className={`flex items-center gap-3 rounded-lg px-2 py-[7px] transition-colors hover:bg-slate-50 ${indent ? 'ml-3 border-l-2 border-slate-100 pl-3' : ''}`}>
      <span className={`min-w-0 flex-1 ${small ? 'text-xs text-slate-500' : 'text-sm text-slate-600'}`}>{label}</span>
      <span className={`${large ? 'text-lg' : small ? 'text-[13px]' : 'text-sm'} shrink-0 font-mono tabular-nums ${bold ? 'font-extrabold' : 'font-bold'} ${textClass}`}>
        {formatCurrencyDisplay(numeric)}
      </span>
    </div>
  );
}

const JENIS_LABELS: Record<string, string> = {
  CASH: 'Kas Tunai (Lama)',
  BANK_BCA: 'BCA (Lama)',
  BANK_MANDIRI: 'Mandiri (Lama)',
  BANK_BRI: 'BRI (Lama)',
  BANK_LAINNYA: 'Bank Lainnya (Lama)',
  KAS_UTAMA: 'Kas Kantor Utama',
  BANK_UTAMA: 'Bank Utama (BCA)',
  KAS_UNIT_BENGKEL: 'Bengkel (Cash)',
  KAS_UNIT_JASA_ANGKUT: 'Jasa Angkut (Cash)',
  KAS_UNIT_MOBIL: 'Mobil (Cash)',
};

export const kasJenisLabel = (jenis: string) => JENIS_LABELS[jenis] || jenis.replace(/_/g, ' ');

// Port of KasJenisBreakdown — snapshot balances, hide zero accounts.
export function KasJenisBreakdown({ details }: { details?: KasJenisDetail[] }) {
  const rows = (details || []).filter((d) => Number(d.saldo || 0) !== 0);
  if (rows.length === 0) return null;
  return (
    <div className="mt-1 w-full pl-3">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Per Akun Keuangan</p>
      {rows.map((d, i) => (
        <FinancialRow key={`${d.jenis}-${i}`} label={kasJenisLabel(d.jenis)} value={d.saldo} small indent />
      ))}
    </div>
  );
}

// Port of KasArusJenisBreakdown — period flows, hide accounts without mutation.
export function KasArusJenisBreakdown({ flows, period }: { flows?: KasArusJenis[]; period?: PeriodParams }) {
  const rows = (flows || []).filter((f) => Number(f.masuk || 0) !== 0 || Number(f.keluar || 0) !== 0);
  if (rows.length === 0) return null;
  return (
    <div className="mt-1 w-full">
      {rows.map((f, i) => (
        <div key={`${f.jenis}-${i}`} className="mb-1">
          <FinancialRow label={kasJenisLabel(f.jenis)} value={f.net} small bold />
          <div className="pl-4">
            {(f.masuk || 0) !== 0 && <FinancialRow label="Masuk" value={f.masuk} small indent />}
            {(f.keluar || 0) !== 0 && <FinancialRow label="Keluar" value={f.keluar} small indent isNegative />}
          </div>
          {period && (
            <Drill
              spec={{
                key: `kas-${f.jenis}`,
                label: `Rincian mutasi ${kasJenisLabel(f.jenis)}`,
                columns: [
                  { key: 'tanggal', header: 'Tanggal', render: (r) => String(r.tanggal ?? '-').slice(0, 10) },
                  { key: 'nomor_transaksi', header: 'Referensi' },
                  { key: 'tipe', header: 'Tipe' },
                  { key: 'keterangan', header: 'Keterangan' },
                  { key: 'signed', header: 'Nominal', align: 'right', render: (r) => formatCurrency(r.signed) },
                ],
                fetch: async (p) => {
                  const res = await drillService.kasJenis(f.jenis, p);
                  return {
                    ...res,
                    data: res.data.map((r) => ({
                      ...r,
                      signed: r.tipe === 'KELUAR' ? -Number(r.nominal ?? 0) : Number(r.nominal ?? 0),
                    })),
                  };
                },
              }}
              period={period}
              amountKey="signed"
              total={f.net}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export type FilterType = 'daily' | 'monthly' | 'yearly';

export interface Period {
  tanggal_dari: string;
  tanggal_sampai: string;
  label: string;
  [key: string]: unknown;
}

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Port of ReportDateControls period logic (date-fns -> native Date).
export function usePeriodFilter(initial: FilterType = 'monthly') {
  const [filterType, setFilterType] = useState<FilterType>(initial);
  const [cursor, setCursor] = useState(() => new Date());
  const shift = (dir: 1 | -1) => {
    setCursor((prev) => {
      const d = new Date(prev);
      if (filterType === 'daily') d.setDate(d.getDate() + dir);
      else if (filterType === 'monthly') d.setMonth(d.getMonth() + dir);
      else d.setFullYear(d.getFullYear() + dir);
      return d;
    });
  };

  let period: Period;
  if (filterType === 'daily') {
    const iso = toISO(cursor);
    period = {
      tanggal_dari: iso,
      tanggal_sampai: iso,
      label: cursor.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    };
  } else if (filterType === 'monthly') {
    const dari = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const sampai = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    period = {
      tanggal_dari: toISO(dari),
      tanggal_sampai: toISO(sampai),
      label: cursor.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    };
  } else {
    period = {
      tanggal_dari: `${cursor.getFullYear()}-01-01`,
      tanggal_sampai: `${cursor.getFullYear()}-12-31`,
      label: String(cursor.getFullYear()),
    };
  }
  return { filterType, setFilterType, shift, period };
}

export function PeriodControls({
  filterType,
  onType,
  label,
  onPrev,
  onNext,
}: {
  filterType: FilterType;
  onType: (t: FilterType) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {(['daily', 'monthly', 'yearly'] as FilterType[]).map((t) => (
          <button
            key={t}
            onClick={() => onType(t)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              filterType === t ? 'bg-[#0B1F3A] text-white shadow' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t === 'daily' ? 'Harian' : t === 'monthly' ? 'Bulanan' : 'Tahunan'}
          </button>
        ))}
      </div>
      <div className="mx-1 hidden h-6 w-px bg-slate-100 sm:block" />
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          aria-label="Periode sebelumnya"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
        >
          ‹
        </button>
        <span className="min-w-[150px] text-center text-sm font-extrabold capitalize text-slate-800">{label}</span>
        <button
          onClick={onNext}
          aria-label="Periode berikutnya"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
        >
          ›
        </button>
      </div>
    </div>
  );
}

export interface DrillColumn {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render?: (row: Record<string, unknown>) => React.ReactNode;
}

export interface DrillSpec {
  /** Stable key per angka — dipakai sebagai queryKey + reset saat periode berubah. */
  key: string;
  /** Label tombol, mis. "Lihat 12 setoran". */
  label: string;
  columns: DrillColumn[];
  fetch: (p: PeriodParams) => Promise<{ data: Record<string, unknown>[] } | Record<string, unknown>[]>;
}

const cell = (row: Record<string, unknown>, key: string): string => {
  const v = row[key];
  if (v === null || v === undefined || v === '') return '-';
  return String(v);
};

// Baris angka yang bisa di-expand ke daftar transaksi sumbernya.
// Pola: angka laporan = SUM(rows.map(amountKey)) — tampilkan total + selisih cek.
export function Drill({
  spec,
  period,
  amountKey,
  total,
  hideDiff,
}: {
  spec: DrillSpec;
  period: PeriodParams;
  amountKey: string;
  total: number;
  hideDiff?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['drill', spec.key, period.tanggal_dari, period.tanggal_sampai],
    queryFn: () => spec.fetch(period),
    enabled: open,
    staleTime: 30_000,
  });
  const raw = q.data as { data?: Record<string, unknown>[] } | Record<string, unknown>[] | undefined;
  const rows = Array.isArray(raw) ? raw : (raw?.data ?? []);
  const { page, pages, setPage } = usePagination(rows.length);
  const visible = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const sum = rows.reduce((a, r) => a + (typeof r[amountKey] === 'number' ? (r[amountKey] as number) : parseFloat(String(r[amountKey] ?? '0')) || 0), 0);
  const diff = total - sum;

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
          open
            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
            : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-600'
        }`}
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        {open ? 'Tutup rincian' : spec.label}
      </button>
      {open && (
        <div className="animate-fade-up mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {q.isLoading ? (
            <p className="p-4 text-center text-xs text-slate-400">Memuat rincian…</p>
          ) : q.isError ? (
            <p className="p-4 text-center text-xs text-rose-500">Gagal memuat rincian.</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400">Tidak ada transaksi sumber pada periode ini.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left uppercase tracking-wider text-slate-400">
                      {spec.columns.map((c) => (
                        <th key={c.key} className={`px-3 py-2 text-[10px] font-bold ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r, i) => (
                      <tr key={page * PAGE_SIZE + i} className="border-t border-slate-50 hover:bg-indigo-50/40">
                        {spec.columns.map((c) => (
                          <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right font-bold tabular-nums' : 'text-slate-600'}`}>
                            {c.render ? c.render(r) : cell(r, c.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-2">
                <Pager page={page} pages={pages} total={rows.length} onPage={setPage} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-2 text-xs">
                <span className="text-slate-500">
                  {rows.length} baris · Σ <b className="font-mono tabular-nums">{formatCurrency(sum)}</b>
                </span>
                {!hideDiff && (
                  <span className={`rounded-full px-2 py-0.5 font-bold ${Math.abs(diff) < 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {Math.abs(diff) < 100 ? '✓ cocok dengan angka laporan' : `Δ ${formatCurrency(diff)} vs laporan`}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

