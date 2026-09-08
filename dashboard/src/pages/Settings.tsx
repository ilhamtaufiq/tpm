import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileArchive,
  FileSpreadsheet,
  HardDrive,
  Info,
  Lock,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { backupService, dataImportService, systemService } from '../api/services';
import type { BackupFile, ImportResult } from '../api/services';
import { formatCurrencyDisplay } from '../utils/format';
import { Badge, Card, PageHeader } from '../components/ui';

const errMsg = (e: unknown, fallback: string) => {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'message' in detail) return String((detail as { message: unknown }).message);
  return fallback;
};

export function Settings() {
  const [busy, setBusy] = useState<'template' | 'preview' | 'commit' | 'reset' | null>(null);
  const [pickedName, setPickedName] = useState('');
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Backup & restore state ──
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [backupBusy, setBackupBusy] = useState<'list' | 'create' | 'upload' | 'restore' | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const loadBackups = useCallback(async () => {
    try {
      setBackupBusy('list');
      setBackups(await backupService.list());
    } catch {
      setNotice({ tone: 'bad', text: 'Gagal memuat daftar backup.' });
    } finally {
      setBackupBusy(null);
    }
  }, []);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const doCreateBackup = async () => {
    try {
      setBackupBusy('create');
      await backupService.create();
      setNotice({ tone: 'ok', text: 'Backup data berhasil dibuat di server.' });
      await loadBackups();
    } catch (e) {
      setNotice({ tone: 'bad', text: errMsg(e, 'Gagal membuat backup.') });
    } finally {
      setBackupBusy(null);
    }
  };

  const doUploadBackup = async () => {
    const file = uploadRef.current?.files?.[0];
    if (!file) return;
    try {
      setBackupBusy('upload');
      await backupService.upload(file);
      setNotice({ tone: 'ok', text: 'File backup berhasil diunggah ke server.' });
      await loadBackups();
    } catch (e) {
      setNotice({ tone: 'bad', text: errMsg(e, 'Gagal mengunggah backup.') });
    } finally {
      setBackupBusy(null);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  };

  const doDeleteBackup = async (filename: string) => {
    if (deleteConfirm !== filename) {
      setDeleteConfirm(filename);
      return;
    }
    try {
      await backupService.remove(filename);
      setDeleteConfirm(null);
      setNotice({ tone: 'ok', text: `Backup ${filename} dihapus.` });
      await loadBackups();
    } catch (e) {
      setDeleteConfirm(null);
      setNotice({ tone: 'bad', text: errMsg(e, 'Gagal menghapus backup.') });
    }
  };

  const doRestore = async () => {
    if (!restoreTarget) return;
    if (!restorePassword) {
      setNotice({ tone: 'bad', text: 'Masukkan password admin untuk melanjutkan.' });
      return;
    }
    try {
      setBackupBusy('restore');
      await backupService.restore(restoreTarget.filename, restorePassword);
      setRestoreTarget(null);
      setRestorePassword('');
      setNotice({ tone: 'ok', text: 'Sistem direstore. Silakan muat ulang / login kembali.' });
    } catch (e) {
      setNotice({ tone: 'bad', text: errMsg(e, 'Gagal restore — pastikan password benar.') });
    } finally {
      setBackupBusy(null);
    }
  };

  const totalErrors = useMemo(() => {
    if (!preview) return 0;
    return Object.values(preview.sheets || {}).reduce((n, s) => n + (s.errors?.length || 0), 0);
  }, [preview]);

  const setFile = (file: File | undefined) => {
    if (!file) return;
    setPickedName(file.name);
    setPreview(null);
    setNotice(null);
  };

  const downloadTemplate = async () => {
    try {
      setBusy('template');
      const blob = await dataImportService.template();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'TPM_IMPORT_TEMPLATE.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      setNotice({ tone: 'ok', text: 'Template Excel berhasil diunduh.' });
    } catch (e) {
      setNotice({ tone: 'bad', text: errMsg(e, 'Gagal unduh template.') });
    } finally {
      setBusy(null);
    }
  };

  const doPreview = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setNotice({ tone: 'bad', text: 'Pilih file Excel dulu.' });
    try {
      setBusy('preview');
      const res = await dataImportService.preview(file);
      setPreview(res);
      setNotice(res.ok
        ? { tone: 'ok', text: 'Preview OK — tidak ada error validasi. Bisa Commit.' }
        : { tone: 'bad', text: 'Ada error validasi. Perbaiki baris bermasalah, Preview ulang.' });
    } catch (e) {
      setNotice({ tone: 'bad', text: errMsg(e, 'Preview gagal.') });
    } finally {
      setBusy(null);
    }
  };

  const doCommit = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setNotice({ tone: 'bad', text: 'Pilih file Excel dulu.' });
    if (preview && !preview.ok) return setNotice({ tone: 'bad', text: 'Preview harus lolos dulu.' });
    try {
      setBusy('commit');
      const res = await dataImportService.commit(file);
      setPreview(res);
      setNotice({ tone: 'ok', text: `Batch ${res.batch_id} tersimpan. Cek stok, dompet, hutang/piutang.` });
    } catch (e) {
      setNotice({ tone: 'bad', text: errMsg(e, 'Import gagal.') });
    } finally {
      setBusy(null);
    }
  };

  const doReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    try {
      setBusy('reset');
      const res = await systemService.resetDatabase();
      setResetConfirm(false);
      setNotice({ tone: 'ok', text: res.message });
    } catch (e) {
      setResetConfirm(false);
      setNotice({ tone: 'bad', text: errMsg(e, 'Reset database gagal.') });
    } finally {
      setBusy(null);
    }
  };

  const nv = preview?.neraca_verification;

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="Pengaturan" sub="Import data & maintenance database (Admin)" />

      {notice && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${notice.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {notice.tone === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {notice.text}
        </div>
      )}

      <Card title="Import Data" sub="Master + opening balance semua modul (multi-sheet)" icon={FileSpreadsheet}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3">
            <Info size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-800">
              Import master + opening balance semua modul. Isi template multi-sheet, Preview dulu, lalu Commit.
              Backup DB sebelum production. Kas/bank opening mencakup KAS_UTAMA, BANK_UTAMA, KAS_UNIT_BENGKEL,
              KAS_UNIT_JASA_ANGKUT, KAS_UNIT_MOBIL. Idempotent per batch untuk kas/hutang/piutang opening.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">1. Download template</p>
            <button
              onClick={downloadTemplate}
              disabled={!!busy}
              className="rounded-xl bg-[#0B1F3A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#14305a] disabled:opacity-50"
            >
              {busy === 'template' ? 'Mengunduh…' : 'Download TPM_IMPORT_TEMPLATE.xlsx'}
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">2. Pilih file Excel</p>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-5 hover:bg-slate-50">
              <FileSpreadsheet size={26} className="text-indigo-500" />
              <div>
                <p className="text-sm font-bold text-slate-700">{pickedName || 'Ketuk untuk pilih .xlsx'}</p>
                <p className="text-xs text-slate-400">Maks 8MB · multi-sheet</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0])}
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">3. Preview & Commit</p>
            <div className="flex gap-3">
              <button
                onClick={doPreview}
                disabled={!!busy || !pickedName}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === 'preview' ? 'Preview…' : 'Preview'}
              </button>
              <button
                onClick={doCommit}
                disabled={!!busy || !pickedName || (preview ? !preview.ok : false)}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy === 'commit' ? 'Commit…' : 'Commit'}
              </button>
            </div>
          </div>

          {preview && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                {preview.ok ? <CheckCircle2 size={15} className="text-emerald-600" /> : <AlertTriangle size={15} className="text-rose-600" />}
                <span>Batch {preview.batch_id} · {preview.dry_run ? 'dry-run' : 'committed'} · error {totalErrors}</span>
              </div>
              {Object.entries(preview.sheets || {}).map(([name, s]) => (
                <div key={name} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">{name}</span>
                    <Badge tone={s.errors?.length ? 'bad' : 'ok'}>{s.errors?.length ? `${s.errors.length} err` : 'OK'}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">rows {s.rows} · +{s.created} · ~{s.updated} · skip {s.skipped}</p>
                  {(s.errors || []).slice(0, 5).map((e, i) => (
                    <p key={i} className="mt-0.5 text-[11px] text-rose-600">• {e}</p>
                  ))}
                </div>
              ))}
              {preview.unknown_sheets?.length ? (
                <p className="text-xs text-amber-700">Sheet tidak dikenali: {preview.unknown_sheets.join(', ')}</p>
              ) : null}
            </div>
          )}

          {nv && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  {nv.is_balanced ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-rose-600" />}
                  Verifikasi Neraca
                </span>
                <Badge tone={nv.is_balanced ? 'ok' : 'bad'}>{nv.is_balanced ? 'SEIMBANG' : 'SELISIH'}</Badge>
              </div>
              <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
                {[
                  ['Kas', 'total_kas'],
                  ['Piutang', 'total_piutang'],
                  ['Persediaan Sparepart', 'persediaan_sparepart'],
                  ['Aset Tetap', 'total_aset_tetap'],
                  ['Mobil', 'total_mobil'],
                  ['Aktiva', 'total_aktiva'],
                  ['Hutang', 'total_hutang'],
                  ['Hutang Part', 'hutang_part'],
                  ['Hutang Mobil', 'hutang_mobil'],
                ].map(([label, key]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className={`font-semibold ${key === 'total_aktiva' ? 'text-slate-900' : 'text-slate-700'}`}>
                      {formatCurrencyDisplay(nv.computed?.[key])}
                    </span>
                  </div>
                ))}
              </div>
              {nv.warnings?.map((w, i) => (
                <p key={i} className="mt-0.5 text-[11px] text-rose-600">• {w}</p>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Backup & Restore" sub="Amankan data transaksi & file" icon={FileArchive}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {([
              ['BACKUPS', String(backups.length), FileArchive, '#F59E0B'],
              ['STORAGE', formatSize(backups.reduce((a, b) => a + (b.size || 0), 0)), HardDrive, '#3B82F6'],
              ['STATUS', 'SAFE', Database, '#10B981'],
            ] as [string, string, typeof FileArchive, string][]).map(([label, value, Icon, color]) => (
              <div key={label} className="rounded-2xl border border-slate-100 bg-white p-3 text-center">
                <span className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}15` }}>
                  <Icon size={15} style={{ color }} />
                </span>
                <p className="truncate text-sm font-extrabold uppercase" style={{ color }}>{value}</p>
                <p className="text-[9px] font-bold tracking-widest text-slate-400">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={doCreateBackup}
              disabled={!!backupBusy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0B1F3A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#14305a] disabled:opacity-50"
            >
              <Database size={15} />
              {backupBusy === 'create' ? 'Membuat…' : 'Backup Sekarang'}
            </button>
            <button
              onClick={() => uploadRef.current?.click()}
              disabled={!!backupBusy}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Upload size={15} />
              Upload .zip
            </button>
            <button
              onClick={loadBackups}
              disabled={!!backupBusy}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={backupBusy === 'list' ? 'animate-spin' : ''} />
            </button>
            <input ref={uploadRef} type="file" accept=".zip" className="hidden" onChange={doUploadBackup} />
          </div>

          {backups.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              Belum ada backup. Buat backup pertama Anda.
            </p>
          ) : (
            <div className="space-y-2">
              {backups.map((b) => (
                <div key={b.filename} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{b.filename}</p>
                      <p className="text-[11px] text-slate-400">{fmtDate(b.created_at)} · {formatSize(b.size)}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => backupService.download(b.filename)} title="Download" className="rounded-lg bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100">
                        <Download size={14} />
                      </button>
                      <button onClick={() => { setRestoreTarget(b); setRestorePassword(''); }} title="Restore" className="rounded-lg bg-indigo-50 p-2 text-indigo-600 hover:bg-indigo-100">
                        <RefreshCw size={14} />
                      </button>
                      <button onClick={() => doDeleteBackup(b.filename)} title="Hapus" className="rounded-lg bg-rose-50 p-2 text-rose-600 hover:bg-rose-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {deleteConfirm === b.filename && (
                    <button onClick={() => doDeleteBackup(b.filename)} className="mt-2 w-full rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700">
                      Konfirmasi hapus {b.filename}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Maintenance Database" sub="Reset seluruh data transaksi" icon={Database}>
        <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50/70 p-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-600" />
          <p className="text-xs leading-relaxed text-rose-700">
            Reset database mengosongkan <b>semua</b> tabel data (transaksi, master, stok, kas, hutang/piutang),
            menyisakan <b>hanya user admin</b>. Data yang terhapus tidak dapat dikembalikan.
          </p>
        </div>
        {resetConfirm && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Yakin? Klik tombol sekali lagi untuk konfirmasi reset permanen.
          </div>
        )}
        <button
          onClick={doReset}
          disabled={!!busy}
          className="mt-3 flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          <Trash2 size={15} />
          {busy === 'reset' ? 'Meriset…' : resetConfirm ? 'Konfirmasi Reset' : 'Reset Database'}
        </button>
      </Card>

      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6">
            <div className="mb-4 text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
                <AlertTriangle size={28} className="text-rose-500" />
              </span>
              <h3 className="text-base font-extrabold text-slate-900">Konfirmasi Restore</h3>
              <p className="mt-1 text-xs text-slate-500">Data saat ini akan digantikan oleh backup:</p>
              <p className="mt-1 truncate text-xs font-bold text-indigo-600">{restoreTarget.filename}</p>
            </div>
            <div className="mb-5">
              <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
                <Lock size={11} /> Password Verifikasi
              </label>
              <input
                type="password"
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                placeholder="Masukkan password admin…"
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400"
              />
            </div>
            <div className="space-y-2">
              <button
                onClick={doRestore}
                disabled={backupBusy === 'restore'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {backupBusy === 'restore' ? 'Merestore…' : 'Ya, Restore Data'}
              </button>
              <button
                onClick={() => { setRestoreTarget(null); setRestorePassword(''); }}
                disabled={backupBusy === 'restore'}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-50"
              >
                Batalkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
