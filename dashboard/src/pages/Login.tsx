import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../store/auth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0B1F3A]">
      {/* Brand panel */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-rose-600/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-rose-500 text-xl font-extrabold text-white">T</span>
          <div>
            <p className="text-lg font-extrabold text-white">TPM Monitoring</p>
            <p className="text-xs text-slate-400">Tiga Putra Motor · Super App</p>
          </div>
        </div>
        <div className="relative">
          <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight text-white">
            Seluruh bisnis, terpantau dalam satu layar.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            Bengkel, jual beli mobil, jasa angkut, SDM, dan keuangan — mengalir real-time dari sistem yang sama dengan aplikasi kasir.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
            {[
              ['5', 'Domain bisnis'],
              ['Live', 'Update WS'],
              ['R/O', 'Read-only aman'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xl font-extrabold text-white">{v}</p>
                <p className="text-[11px] text-slate-400">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">Dashboard read-only · tidak dapat mengubah data finansial</p>
      </div>
      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-[#F1F5F9] p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <ShieldCheck size={24} />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Selamat datang</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">Masuk dengan akun Owner / Manager.</p>
          {error && (
            <p className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
          <label className="mb-3 block text-sm font-medium text-slate-700">
            Username
            <span className="relative mt-1.5 block">
              <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                autoComplete="username"
                placeholder="nama pengguna"
                required
              />
            </span>
          </label>
          <label className="mb-6 block text-sm font-medium text-slate-700">
            Password
            <span className="relative mt-1.5 block">
              <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-10 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#0B1F3A] py-3 font-bold text-white transition hover:bg-[#14305a] disabled:opacity-50"
          >
            {busy ? 'Memeriksa…' : 'Masuk Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
