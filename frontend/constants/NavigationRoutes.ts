import { Wrench, Truck, CarFront, Users, BarChart3, Database, Receipt, History, Wallet, User, ShieldCheck, Printer, Settings } from 'lucide-react-native';

export interface AppRoute {
    id: string;
    label: string;
    description: string;
    path: string;
    icon: any;
    category: string;
    keywords: string[];
}

export const APP_ROUTES: AppRoute[] = [
    // --- Utama ---
    { id: 'home', label: 'Home', description: 'Halaman utama aplikasi', path: '/home', icon: ShieldCheck, category: 'Utama', keywords: ['beranda', 'dashboard', 'depan'] },

    // --- Bengkel ---
    { id: 'bengkel', label: 'Transaksi Bengkel', description: 'Input servis dan servis motor', path: '/bengkel', icon: Wrench, category: 'Bengkel', keywords: ['servis', 'mekanik', 'sparepart', 'motor'] },
    { id: 'bengkel-inv', label: 'Stok Toko', description: 'Lihat stok sparepart bengkel', path: '/bengkel/inventory', icon: Database, category: 'Bengkel', keywords: ['stok', 'barang', 'inventory'] },
    { id: 'bengkel-pur', label: 'Restock Barang', description: 'Input pembelian stok baru', path: '/bengkel/purchase', icon: Receipt, category: 'Bengkel', keywords: ['beli', 'kulakan', 'order'] },
    { id: 'bengkel-exp', label: 'Biaya Bengkel', description: 'Catat pengeluaran operasional', path: '/bengkel/expenses', icon: Wallet, category: 'Bengkel', keywords: ['keluar', 'ops', 'biaya'] },

    // --- Jasa Angkut ---
    { id: 'angkut', label: 'Jasa Angkut', description: 'Input muatan dan logistik', path: '/jasa-angkut', icon: Truck, category: 'Logistik', keywords: ['truk', 'muatan', 'kirim', 'angkut'] },
    { id: 'supir', label: 'Data Supir', description: 'Kelola data dan komisi supir', path: '/jasa-angkut/supir', icon: Users, category: 'Logistik', keywords: ['driver', 'karyawan', 'angkut'] },

    // --- Mobil ---
    { id: 'mobil', label: 'Jual Beli Mobil', description: 'Daftar stok mobil dan penjualan', path: '/mobil', icon: CarFront, category: 'Mobil', keywords: ['mobil', 'jual', 'beli', 'showroom'] },

    // --- Master Data ---
    { id: 'master', label: 'Menu Master Data', description: 'Pusat pengaturan data dasar', path: '/master-data', icon: Database, category: 'Master', keywords: ['data', 'pengaturan'] },
    { id: 'master-cust', label: 'Data Customer', description: 'Kelola database pelanggan', path: '/master-data/customer', icon: User, category: 'Master', keywords: ['pelanggan', 'pembeli'] },
    { id: 'master-spare', label: 'Data Sparepart', description: 'Master data barang & harga', path: '/master-data/sparepart', icon: Receipt, category: 'Master', keywords: ['barang', 'onderdil'] },
    { id: 'master-supp', label: 'Data Supplier', description: 'Daftar pemasok barang', path: '/master-data/supplier', icon: Truck, category: 'Master', keywords: ['pemasok', 'kulakan'] },
    { id: 'master-serv', label: 'Jasa Servis', description: 'Master tarif jasa bengkel', path: '/master-data/jasa-servis', icon: Wrench, category: 'Master', keywords: ['ongkos', 'biaya'] },

    // --- SDM ---
    { id: 'sdm', label: 'Menu SDM', description: 'Manajemen sumber daya manusia', path: '/sdm', icon: Users, category: 'SDM', keywords: ['karyawan', 'pegawai'] },
    { id: 'sdm-karyawan', label: 'Data Karyawan', description: 'Database lengkap personil', path: '/sdm/karyawan', icon: User, category: 'SDM', keywords: ['pegawai', 'staff'] },
    { id: 'sdm-absensi', label: 'Absensi', description: 'Catat kehadiran harian', path: '/sdm/absensi', icon: ShieldCheck, category: 'SDM', keywords: ['hadir', 'masuk', 'absen'] },
    { id: 'sdm-kasbon', label: 'Kasbon', description: 'Pinjaman dan cicilan karyawan', path: '/sdm/kasbon', icon: Wallet, category: 'SDM', keywords: ['hutang', 'pinjam'] },
    { id: 'sdm-gaji', label: 'Slip Gaji', description: 'Generate slip gaji bulanan', path: '/sdm/slip-gaji', icon: Receipt, category: 'SDM', keywords: ['payroll', 'upah'] },

    // --- Laporan ---
    { id: 'laporan', label: 'Semua Laporan', description: 'Dashboard rekapitulasi bisnis', path: '/laporan', icon: BarChart3, category: 'Laporan', keywords: ['rekap', 'stats'] },
    { id: 'labarugi', label: 'Laba Rugi', description: 'Laporan keuangan untung rugi', path: '/laporan/laba-rugi', icon: BarChart3, category: 'Laporan', keywords: ['keuangan', 'profit'] },
    { id: 'lap-bengkel', label: 'Lap. Penjualan Bengkel', description: 'Rekap harian/bulanan bengkel', path: '/laporan/penjualan-bengkel', icon: BarChart3, category: 'Laporan', keywords: ['bengkel', 'servis'] },
    { id: 'lap-mobil', label: 'Lap. Penjualan Mobil', description: 'Rekap penjualan unit mobil', path: '/laporan/penjualan-mobil', icon: BarChart3, category: 'Laporan', keywords: ['mobil', 'jual'] },
    { id: 'lap-angkut', label: 'Lap. Jasa Angkut', description: 'Dashboard stats logistik', path: '/laporan/jasa-angkut', icon: BarChart3, category: 'Laporan', keywords: ['truk', 'muatan'] },

    // --- Finance ---
    { id: 'fin-mutasi', label: 'Mutasi Kas', description: 'Arus keluar masuk uang', path: '/finance/mutasi', icon: History, category: 'Finance', keywords: ['bank', 'tunai', 'kas', 'transfer', 'setor', 'tarik', 'dompet'] },
    { id: 'fin-piutang', label: 'Piutang Usaha', description: 'Tagihan yang belum dibayar pelanggan', path: '/finance/piutang', icon: Wallet, category: 'Finance', keywords: ['tagihan', 'hutang', 'bon', 'cicilan', 'bayar'] },

    // --- Settings ---
    { id: 'settings-profile', label: 'Ubah Profil', description: 'Atur nama dan informasi akun', path: '/settings/profile', icon: User, category: 'Sistem', keywords: ['akun', 'bio', 'admin', 'profil'] },
    { id: 'settings-password', label: 'Ubah Kata Sandi', description: 'Perbarui keamanan akun Anda', path: '/settings/password', icon: ShieldCheck, category: 'Sistem', keywords: ['password', 'sandi', 'keamanan', 'privacy'] },
    { id: 'settings-print', label: 'Pengaturan Printer', description: 'Setup cetak struk bluetooth', path: '/settings/print', icon: Printer, category: 'Sistem', keywords: ['cetak', 'kertas', 'struk', 'nota', 'bluetooth'] },
    { id: 'settings-bt', label: 'Bluetooth', description: 'Koneksi perangkat bluetooth', path: '/settings/bluetooth', icon: Settings, category: 'Sistem', keywords: ['pairing', 'koneksi', 'wireless'] },
    { id: 'profile', label: 'Profil Saya', description: 'Informasi akun dan logout', path: '/profile', icon: User, category: 'Sistem', keywords: ['akun', 'keluar', 'logout', 'admin'] },
];
