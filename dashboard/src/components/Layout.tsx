import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Banknote,
  Boxes,
  Car,
  LayoutDashboard,
  LogOut,
  Menu,
  Scale,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../store/auth';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: string;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, group: 'Utama' },
  { to: '/transaksi', label: 'Transaksi', icon: ArrowLeftRight, group: 'Utama' },
  { to: '/laba-rugi', label: 'Laba Rugi', icon: TrendingUp, group: 'Laporan' },
  { to: '/neraca', label: 'Neraca', icon: Scale, group: 'Laporan' },
  { to: '/modal', label: 'Modal', icon: Wallet, group: 'Laporan' },
  { to: '/hutang-piutang', label: 'Hutang-Piutang', icon: Wallet, group: 'Laporan' },
  { to: '/kas', label: 'Kas per Akun', icon: Banknote, group: 'Laporan' },
  { to: '/stok', label: 'Stok', icon: Boxes, group: 'Operasional' },
  { to: '/mobil', label: 'Mobil', icon: Car, group: 'Operasional' },
  { to: '/angkut', label: 'Angkut', icon: Truck, group: 'Operasional' },
  { to: '/sdm', label: 'SDM', icon: Users, group: 'Operasional' },
];

function Sidebar({ onNav }: { onNav?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  let lastGroup = '';

  return (
    <div className="flex h-full flex-col bg-[#0B1F3A] text-white">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-rose-500 text-lg font-extrabold">
          T
        </span>
        <div>
          <p className="text-base font-extrabold leading-tight tracking-tight">TPM Monitoring</p>
          <p className="text-[11px] text-slate-400">Tiga Putra Motor · read-only</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => {
          const head = item.group !== lastGroup ? (
            <p key={item.group} className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
              {item.group}
            </p>
          ) : null;
          lastGroup = item.group;
          const Icon = item.icon;
          return (
            <div key={item.to}>
              {head}
              <NavLink
                to={item.to}
                end={item.to === '/'}
                onClick={onNav}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/10 text-white shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon size={17} />
                {item.label}
              </NavLink>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 px-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/30 text-sm font-bold">
            {(user?.full_name ?? user?.username ?? '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{user?.full_name ?? user?.username}</p>
            <p className="text-[11px] text-slate-400">{user?.role} · Owner area</p>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <LogOut size={15} /> Keluar
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <Sidebar />
      </aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72">
            <Sidebar onNav={() => setOpen(false)} />
          </aside>
          <button
            aria-label="Tutup menu"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"
          >
            <X size={18} />
          </button>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
            <button
              aria-label="Buka menu"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"
            >
              <Menu size={18} />
            </button>
            <p className="text-sm text-slate-400">
              Monitoring operasional & keuangan <span className="text-slate-300">·</span>{' '}
              <span className="font-semibold text-slate-600">real-time</span>
            </p>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
