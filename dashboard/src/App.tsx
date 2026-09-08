import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './store/auth';
import { useRealtime } from './hooks/useRealtime';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Transaksi from './pages/Transaksi';
import { HutangPiutang, LabaRugi, Modal, Neraca } from './pages/Reports';
import { Settings } from './pages/Settings';
import Kas from './pages/Kas';
import Lacak from './pages/Lacak';
import { Angkut, Mobil, Sdm, Stok } from './pages/Domains';

import type { ReactElement } from 'react';

function Guard({ children }: { children: ReactElement }) {
  const { token, user, ready } = useAuth();
  if (!ready) return null;
  if (!token || !user) return <Navigate to="/login" replace />;
  return children;
}

function Shell() {
  const { token, user } = useAuth();
  useRealtime(Boolean(token && user));
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route index element={<Overview />} />
        <Route path="transaksi" element={<Transaksi />} />
        <Route path="lacak" element={<Lacak />} />
        <Route path="laba-rugi" element={<LabaRugi />} />
        <Route path="neraca" element={<Neraca />} />
        <Route path="modal" element={<Modal />} />
        <Route path="hutang-piutang" element={<HutangPiutang />} />
        <Route path="kas" element={<Kas />} />
        <Route path="stok" element={<Stok />} />
        <Route path="mobil" element={<Mobil />} />
        <Route path="angkut" element={<Angkut />} />
        <Route path="sdm" element={<Sdm />} />
        <Route path="pengaturan" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
