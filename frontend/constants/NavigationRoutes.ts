import { Wrench, Truck, TruckFront, CarFront, Users, BarChart3, LayoutDashboard, Database, Receipt, History, Wallet, User, UserPlus, ShieldCheck, Printer, Settings, Home, ShoppingCart, CirclePlus, Boxes, ArrowRightLeft, Package, Archive, FileText, Landmark, CircleDollarSign, Banknote, ArrowDownCircle, Scale } from 'lucide-react-native';

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
    { id: 'home', label: 'Home', description: 'Halaman utama aplikasi', path: '/home', icon: Home, category: 'Utama', keywords: ['beranda', 'dashboard', 'depan'] },

    // --- Bengkel ---
    { id: 'bengkel', label: 'Transaksi Bengkel', description: 'Input servis dan servis motor', path: '/bengkel', icon: Wrench, category: 'Bengkel', keywords: ['servis', 'mekanik', 'sparepart', 'motor'] },
    { id: 'bengkel-transaksi', label: 'Tambah Transaksi Bengkel', description: 'Buat transaksi servis dan sparepart', path: '/bengkel/transaksi', icon: ShoppingCart, category: 'Bengkel', keywords: ['kasir', 'transaksi', 'servis', 'sparepart'] },
    { id: 'bengkel-inv', label: 'Stok Toko', description: 'Lihat stok sparepart bengkel', path: '/bengkel/inventory', icon: Boxes, category: 'Bengkel', keywords: ['stok', 'barang', 'inventory'] },
    { id: 'bengkel-pur', label: 'Restock Barang', description: 'Input pembelian stok baru', path: '/bengkel/purchase', icon: CirclePlus, category: 'Bengkel', keywords: ['beli', 'kulakan', 'order'] },
    { id: 'bengkel-exp', label: 'Biaya Bengkel', description: 'Catat pengeluaran operasional', path: '/bengkel/expenses', icon: Wallet, category: 'Bengkel', keywords: ['keluar', 'ops', 'biaya'] },

    // --- Jasa Angkut ---
    { id: 'angkut', label: 'Jasa Angkut', description: 'Input muatan dan logistik', path: '/jasa-angkut', icon: Truck, category: 'Logistik', keywords: ['truk', 'muatan', 'kirim', 'angkut'] },
    { id: 'angkut-armada', label: 'Data Armada', description: 'Kelola unit armada jasa angkut', path: '/jasa-angkut/armada', icon: TruckFront, category: 'Logistik', keywords: ['truk', 'unit', 'armada'] },
    { id: 'angkut-armada-form', label: 'Form Armada', description: 'Tambah atau ubah data armada', path: '/jasa-angkut/armada/form', icon: CirclePlus, category: 'Logistik', keywords: ['form', 'tambah', 'edit', 'armada'] },
    { id: 'angkut-muatan-form', label: 'Form Muatan', description: 'Input muatan jasa angkut', path: '/jasa-angkut/muatan/form', icon: FileText, category: 'Logistik', keywords: ['muatan', 'ritase', 'ongkos'] },
    { id: 'supir', label: 'Data Supir', description: 'Kelola data dan komisi supir', path: '/jasa-angkut/supir', icon: Users, category: 'Logistik', keywords: ['driver', 'karyawan', 'angkut'] },
    { id: 'supir-form', label: 'Form Supir', description: 'Tambah atau ubah data supir', path: '/jasa-angkut/supir/form', icon: UserPlus, category: 'Logistik', keywords: ['driver', 'supir', 'form'] },

    // --- Mobil ---
    { id: 'mobil', label: 'Jual Beli Mobil', description: 'Daftar stok mobil dan penjualan', path: '/mobil', icon: CarFront, category: 'Mobil', keywords: ['mobil', 'jual', 'beli', 'showroom'] },

    // --- Master Data ---
    { id: 'master', label: 'Menu Master Data', description: 'Pusat pengaturan data dasar', path: '/master-data', icon: Database, category: 'Master', keywords: ['data', 'pengaturan'] },
    { id: 'master-cust', label: 'Data Customer', description: 'Kelola database pelanggan', path: '/master-data/customer', icon: Users, category: 'Master', keywords: ['pelanggan', 'pembeli'] },
    { id: 'master-spare', label: 'Data Sparepart', description: 'Master data barang & harga', path: '/master-data/sparepart', icon: Package, category: 'Master', keywords: ['barang', 'onderdil'] },
    { id: 'master-supp', label: 'Data Supplier', description: 'Daftar pemasok barang', path: '/master-data/supplier', icon: Truck, category: 'Master', keywords: ['pemasok', 'kulakan'] },
    { id: 'master-serv', label: 'Jasa Servis', description: 'Master tarif jasa bengkel', path: '/master-data/jasa-servis', icon: Wrench, category: 'Master', keywords: ['ongkos', 'biaya'] },
    { id: 'master-asset', label: 'Data Asset', description: 'Kelola asset operasional', path: '/master-data/asset', icon: Archive, category: 'Master', keywords: ['aset', 'asset', 'inventaris'] },

    // --- SDM ---
    { id: 'sdm', label: 'Menu SDM', description: 'Manajemen sumber daya manusia', path: '/sdm', icon: Users, category: 'SDM', keywords: ['karyawan', 'pegawai'] },
    { id: 'sdm-karyawan', label: 'Data Karyawan', description: 'Database lengkap personil', path: '/sdm/karyawan', icon: UserPlus, category: 'SDM', keywords: ['pegawai', 'staff'] },
    { id: 'sdm-absensi', label: 'Absensi', description: 'Catat kehadiran harian', path: '/sdm/absensi', icon: ShieldCheck, category: 'SDM', keywords: ['hadir', 'masuk', 'absen'] },
    { id: 'sdm-kasbon', label: 'Kasbon', description: 'Pinjaman dan cicilan karyawan', path: '/sdm/kasbon', icon: Wallet, category: 'SDM', keywords: ['hutang', 'pinjam'] },
    { id: 'sdm-gaji', label: 'Slip Gaji', description: 'Generate slip gaji bulanan', path: '/sdm/slip-gaji', icon: FileText, category: 'SDM', keywords: ['payroll', 'upah'] },

    // --- Laporan ---
    { id: 'laporan', label: 'Semua Laporan', description: 'Dashboard rekapitulasi bisnis', path: '/laporan', icon: LayoutDashboard, category: 'Laporan', keywords: ['rekap', 'stats'] },
    { id: 'labarugi', label: 'Laba Rugi', description: 'Laporan keuangan untung rugi', path: '/laporan/laba-rugi', icon: BarChart3, category: 'Laporan', keywords: ['keuangan', 'profit'] },
    { id: 'lap-bengkel', label: 'Lap. Penjualan Bengkel', description: 'Rekap harian/bulanan bengkel', path: '/laporan/penjualan-bengkel', icon: Wrench, category: 'Laporan', keywords: ['bengkel', 'servis'] },
    { id: 'lap-mobil', label: 'Lap. Penjualan Mobil', description: 'Rekap penjualan unit mobil', path: '/laporan/penjualan-mobil', icon: CarFront, category: 'Laporan', keywords: ['mobil', 'jual'] },
    { id: 'lap-angkut', label: 'Lap. Jasa Angkut', description: 'Dashboard stats logistik', path: '/laporan/jasa-angkut', icon: Truck, category: 'Laporan', keywords: ['truk', 'muatan'] },
    { id: 'lap-stock-sparepart', label: 'Lap. Stock Sparepart', description: 'Rekap stok sparepart bengkel', path: '/laporan/stock-sparepart', icon: Boxes, category: 'Laporan', keywords: ['stok', 'sparepart', 'barang'] },
    { id: 'lap-pembelian-sparepart', label: 'Lap. Pembelian Sparepart', description: 'Rekap pembelian sparepart', path: '/laporan/pembelian-sparepart', icon: ShoppingCart, category: 'Laporan', keywords: ['pembelian', 'sparepart', 'kulakan'] },
    { id: 'lap-pembelian-mobil', label: 'Lap. Pembelian Mobil', description: 'Rekap pembelian unit mobil', path: '/laporan/pembelian-mobil', icon: ArrowDownCircle, category: 'Laporan', keywords: ['pembelian', 'mobil', 'unit'] },
    { id: 'lap-perubahan-modal', label: 'Perubahan Modal', description: 'Laporan perubahan modal', path: '/laporan/perubahan-modal', icon: Wallet, category: 'Laporan', keywords: ['modal', 'ekuitas'] },
    { id: 'lap-neraca', label: 'Neraca', description: 'Laporan posisi keuangan', path: '/laporan/neraca', icon: Scale, category: 'Laporan', keywords: ['neraca', 'aset', 'hutang'] },

    // --- Finance ---
    { id: 'finance', label: 'Menu Finance', description: 'Dashboard dan menu keuangan', path: '/finance', icon: Wallet, category: 'Finance', keywords: ['finance', 'keuangan'] },
    { id: 'fin-mutasi', label: 'Mutasi Kas', description: 'Arus keluar masuk uang', path: '/finance/mutasi', icon: ArrowRightLeft, category: 'Finance', keywords: ['bank', 'tunai', 'kas', 'transfer', 'setor', 'tarik', 'dompet'] },
    { id: 'fin-akun', label: 'Akun Kas', description: 'Daftar akun dan saldo kas', path: '/finance/akun', icon: Landmark, category: 'Finance', keywords: ['akun', 'kas', 'saldo'] },
    { id: 'fin-expenses', label: 'Pengeluaran', description: 'Catat pengeluaran operasional', path: '/finance/expenses', icon: Receipt, category: 'Finance', keywords: ['expense', 'keluar', 'biaya'] },
    { id: 'fin-user-cash', label: 'Catatan Cash User', description: 'Kelola saldo cash yang dipegang user', path: '/finance/user-cash', icon: User, category: 'Finance', keywords: ['cash', 'user', 'saldo', 'dompet'] },
    { id: 'fin-piutang', label: 'Piutang Usaha', description: 'Tagihan yang belum dibayar pelanggan', path: '/finance/piutang', icon: CircleDollarSign, category: 'Finance', keywords: ['tagihan', 'hutang', 'bon', 'cicilan', 'bayar'] },
    { id: 'fin-hutang', label: 'Hutang Usaha', description: 'Tagihan yang harus dibayar', path: '/finance/hutang', icon: ArrowDownCircle, category: 'Finance', keywords: ['hutang', 'tagihan', 'bayar'] },
    { id: 'fin-investor', label: 'Pencairan Investor', description: 'Kelola pencairan dana investor', path: '/finance/pencairan-investor', icon: Banknote, category: 'Finance', keywords: ['investor', 'pencairan', 'modal'] },
    { id: 'fin-laporan', label: 'Laporan Finance', description: 'Ringkasan laporan keuangan', path: '/finance/laporan', icon: BarChart3, category: 'Finance', keywords: ['laporan', 'finance', 'kas'] },

    // --- Settings ---
    { id: 'history', label: 'History', description: 'Riwayat aktivitas transaksi', path: '/history', icon: History, category: 'Sistem', keywords: ['history', 'riwayat'] },
    { id: 'settings-profile', label: 'Ubah Profil', description: 'Atur nama dan informasi akun', path: '/settings/profile', icon: User, category: 'Sistem', keywords: ['akun', 'bio', 'admin', 'profil'] },
    { id: 'settings-password', label: 'Ubah Kata Sandi', description: 'Perbarui keamanan akun Anda', path: '/settings/password', icon: ShieldCheck, category: 'Sistem', keywords: ['password', 'sandi', 'keamanan', 'privacy'] },
    { id: 'settings-print', label: 'Pengaturan Printer', description: 'Setup cetak struk bluetooth', path: '/settings/print', icon: Printer, category: 'Sistem', keywords: ['cetak', 'kertas', 'struk', 'nota', 'bluetooth'] },
    { id: 'settings-bt', label: 'Bluetooth', description: 'Koneksi perangkat bluetooth', path: '/settings/bluetooth', icon: Settings, category: 'Sistem', keywords: ['pairing', 'koneksi', 'wireless'] },
    { id: 'settings-scanner', label: 'Scanner', description: 'Pengaturan scanner barcode', path: '/settings/scanner', icon: Settings, category: 'Sistem', keywords: ['scanner', 'barcode'] },
    { id: 'settings-branding', label: 'Branding', description: 'Atur identitas tampilan aplikasi', path: '/settings/branding', icon: Settings, category: 'Sistem', keywords: ['brand', 'logo', 'nama'] },
    { id: 'settings-theme', label: 'Tema', description: 'Atur warna dan tema aplikasi', path: '/settings/theme', icon: Settings, category: 'Sistem', keywords: ['tema', 'warna', 'dark'] },
    { id: 'settings-navigation', label: 'Bottom Navigasi', description: 'Atur menu bottom bar dan FAB+', path: '/settings/navigation', icon: Settings, category: 'Sistem', keywords: ['navigasi', 'menu', 'bottom', 'fab'] },
    { id: 'settings-security', label: 'Fitur Keamanan', description: 'Pengaturan PIN dan keamanan', path: '/settings/security-features', icon: ShieldCheck, category: 'Sistem', keywords: ['pin', 'security', 'keamanan'] },
    { id: 'settings-smtp', label: 'SMTP Email', description: 'Konfigurasi email SMTP', path: '/settings/smtp', icon: Settings, category: 'Sistem', keywords: ['email', 'smtp'] },
    { id: 'settings-users', label: 'Manajemen User', description: 'Kelola user dan akses aplikasi', path: '/settings/users', icon: Users, category: 'Sistem', keywords: ['user', 'akses', 'role'] },
    { id: 'settings-backup', label: 'Backup Restore', description: 'Backup dan restore data aplikasi', path: '/settings/backup', icon: Database, category: 'Sistem', keywords: ['backup', 'restore', 'data'] },
    { id: 'settings-trash', label: 'Tempat Sampah', description: 'Data yang dihapus sementara', path: '/settings/trash', icon: Database, category: 'Sistem', keywords: ['hapus', 'trash', 'restore'] },
    { id: 'profile', label: 'Profil Saya', description: 'Informasi akun dan logout', path: '/profile', icon: User, category: 'Sistem', keywords: ['akun', 'keluar', 'logout', 'admin'] },
];
