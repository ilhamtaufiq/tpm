// Ported from frontend/utils/format.ts — single source for dashboard display.
export const formatCurrency = (amount: unknown): string => {
  const value = typeof amount === 'number' ? amount : parseFloat(String(amount ?? '0'));
  const safe = Number.isNaN(value) ? 0 : value;
  return 'Rp' + Math.round(safe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const formatCurrencyDisplay = (amount: unknown): string => {
  const value = typeof amount === 'number' ? amount : parseFloat(String(amount ?? '0'));
  const safe = Number.isNaN(value) ? 0 : value;
  const abs = 'Rp' + Math.abs(Math.round(safe)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return safe < 0 ? `(${abs})` : abs;
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const formatDateTime = (dateString: string): string => {
  if (!dateString) return '-';
  // ponytail: backend kirim date-only "YYYY-MM-DD"; new Date() anggap UTC → geser +7 jam WIB. Untuk date-only, tampilkan tanggal saja.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return formatDate(dateString);
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
