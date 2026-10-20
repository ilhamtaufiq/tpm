import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Loader2, Wallet, Wrench } from 'lucide-react';
import { perbaikanService } from '../api/services';
import type { PiutangTanpaKas, TanggalMundur } from '../api/services';
import { formatCurrencyDisplay, formatDate } from '../utils/format';
import { Badge, Card, Empty, Loading, PageHeader } from '../components/ui';

const errMsg = (e: unknown, fallback: string) => {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return fallback;
};

const TANGGAL_VALID = /^\d{4}-\d{2}-\d{2}$/;

// Pilihan akun untuk pencairan: tunai ke kas utama atau laci unit, transfer ke bank utama.
const AKUN_PENCAIRAN = [
  { value: 'TUNAI:KAS_UTAMA', label: 'Tunai · Kas Utama' },
  { value: 'TUNAI:KAS_UNIT_BENGKEL', label: 'Tunai · Kas Unit Bengkel' },
  { value: 'TUNAI:KAS_UNIT_JASA_ANGKUT', label: 'Tunai · Kas Unit Jasa Angkut' },
  { value: 'TUNAI:KAS_UNIT_MOBIL', label: 'Tunai · Kas Unit Jual Beli Mobil' },
  { value: 'TRANSFER:BANK_UTAMA', label: 'Transfer · Bank Utama' },
] as const;

export default function PerbaikanData() {
  const [piutang, setPiutang] = useState<PiutangTanpaKas[] | null>(null);
  const [mundur, setMundur] = useState<TanggalMundur[] | null>(null);
  const [tanggalInput, setTanggalInput] = useState<Record<string, string>>({});
  const [akunPiutang, setAkunPiutang] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const muat = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([perbaikanService.piutangTanpaKas(), perbaikanService.tanggalMundur(1)]);
      setPiutang(p);
      setMundur(m);
    } catch (e) {
      setNotice({ tone: 'bad', text: errMsg(e, 'Gagal memuat data perbaikan') });
    }
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const jalankan = async (kunci: string, pertanyaan: string, aksi: () => Promise<unknown>, sukses: string) => {
    if (!window.confirm(pertanyaan)) return;
    setBusy(kunci);
    setNotice(null);
    try {
      await aksi();
      setNotice({ tone: 'ok', text: sukses });
      await muat();
    } catch (e) {
      setNotice({ tone: 'bad', text: errMsg(e, 'Perbaikan gagal') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Perbaikan Data"
        sub="Koreksi piutang tanpa kas dan kas yang tanggalnya mundur. Hanya ADMIN dan MANAGER."
      />

      {notice && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm ring-1 ${
            notice.tone === 'ok' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      <Card title="Piutang manual tanpa kas" sub="Dibuat tanpa metode pencairan, jadi tidak ada uang keluar yang tercatat." icon={Wallet}>
        {piutang === null ? (
          <Loading />
        ) : piutang.length === 0 ? (
          <Empty text="Tidak ada piutang tanpa kas." icon={CheckCircle2} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {piutang.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-semibold text-slate-900">
                    {p.nomor_piutang} · {p.nama_debitur}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDate(p.tanggal)} · {formatCurrencyDisplay(p.nominal_piutang)}
                  </div>
                  {p.catatan && <div className="text-xs text-slate-400">{p.catatan}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={akunPiutang[p.id] ?? AKUN_PENCAIRAN[0].value}
                    onChange={(e) => setAkunPiutang((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  >
                    {AKUN_PENCAIRAN.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={busy !== null}
                    onClick={() => {
                      const pilihan = akunPiutang[p.id] ?? AKUN_PENCAIRAN[0].value;
                      const [metode, kasJenis] = pilihan.split(':') as ['TUNAI' | 'TRANSFER', string];
                      const label = AKUN_PENCAIRAN.find((a) => a.value === pilihan)?.label ?? kasJenis;
                      jalankan(
                        `${p.id}-catat`,
                        `Catat kas keluar (${label}) untuk ${p.nomor_piutang}?`,
                        () => perbaikanService.catatKasPiutang(p.id, metode, kasJenis),
                        `Kas keluar (${label}) untuk ${p.nomor_piutang} sudah dicatat.`,
                      );
                    }}
                    className="rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Catat kas
                  </button>
                  <button
                    disabled={busy !== null}
                    onClick={() =>
                      jalankan(
                        `${p.id}-batal`,
                        `Batalkan ${p.nomor_piutang}? Pilih ini hanya jika tidak ada uang yang keluar.`,
                        () => perbaikanService.batalkanPiutang(p.id),
                        `${p.nomor_piutang} dibatalkan.`,
                      )
                    }
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Batalkan
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="h-5" />

      <Card
        title="Kas tanggal mundur"
        sub="Kas yang tanggalnya 1 hari sebelum tanggal input. Tanggal yang diusulkan adalah tanggal input."
        icon={CalendarClock}
      >
        {mundur === null ? (
          <Loading />
        ) : mundur.length === 0 ? (
          <Empty text="Tidak ada kas tanggal mundur." icon={CheckCircle2} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {mundur.map((g) => {
              const kunci = `${g.nomor_referensi}|${g.tanggal_lama}`;
              const tanggalBaru = tanggalInput[kunci] ?? g.tanggal_seharusnya;
              const valid = TANGGAL_VALID.test(tanggalBaru);
              return (
                <li key={kunci} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      {g.nomor_referensi}
                      <Badge tone="info">{g.induk ?? 'kas saja'}</Badge>
                    </div>
                    <div className="text-xs text-slate-500">
                      {g.jumlah_baris} baris · {formatCurrencyDisplay(g.total)} · tercatat {formatDate(g.tanggal_lama)}, tanggal input {formatDate(g.tanggal_seharusnya)}
                    </div>
                    {g.keterangan && <div className="text-xs text-slate-400">{g.keterangan}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={tanggalBaru}
                      onChange={(e) => setTanggalInput((prev) => ({ ...prev, [kunci]: e.target.value }))}
                      placeholder="YYYY-MM-DD"
                      className="w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    />
                    <button
                      disabled={!valid || busy !== null}
                      onClick={() =>
                        jalankan(
                          kunci,
                          `Pindahkan tanggal ${g.nomor_referensi} dari ${g.tanggal_lama} ke ${tanggalBaru}?`,
                          () =>
                            perbaikanService.ubahTanggal({
                              nomor_referensi: g.nomor_referensi,
                              tanggal_lama: g.tanggal_lama,
                              tanggal_baru: tanggalBaru,
                            }),
                          `Tanggal ${g.nomor_referensi} dipindah ke ${tanggalBaru}.`,
                        )
                      }
                      className="rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {busy === kunci ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Perbaiki'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <Wrench className="h-3.5 w-3.5" />
        Setiap perbaikan dihitung ulang saldo kas. Cek Neraca setelah perbaikan.
      </div>
    </div>
  );
}
