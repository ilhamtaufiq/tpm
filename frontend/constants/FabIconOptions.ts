import {
    Banknote,
    Car,
    CarFront,
    CircleDollarSign,
    Package,
    Plus,
    Receipt,
    Truck,
    Wallet,
    Wrench,
} from 'lucide-react-native';

export const FAB_ICON_OPTIONS = [
    { id: 'plus', label: 'Tambah', icon: Plus, color: '#EE2737', bgColor: '#FEE2E2' },
    { id: 'wrench', label: 'Bengkel', icon: Wrench, color: '#023C69', bgColor: '#E2EFFC' },
    { id: 'car-front', label: 'Mobil', icon: CarFront, color: '#F97316', bgColor: '#FFEDD5' },
    { id: 'car', label: 'Unit', icon: Car, color: '#F43F5E', bgColor: '#FFE4E6' },
    { id: 'truck', label: 'Angkut', icon: Truck, color: '#6366F1', bgColor: '#E0E7FF' },
    { id: 'receipt', label: 'Transaksi', icon: Receipt, color: '#0F766E', bgColor: '#CCFBF1' },
    { id: 'wallet', label: 'Dompet', icon: Wallet, color: '#2563EB', bgColor: '#DBEAFE' },
    { id: 'banknote', label: 'Kas', icon: Banknote, color: '#10B981', bgColor: '#D1FAE5' },
    { id: 'package', label: 'Stok', icon: Package, color: '#8B5CF6', bgColor: '#EDE9FE' },
    { id: 'circle-dollar', label: 'Uang', icon: CircleDollarSign, color: '#F59E0B', bgColor: '#FEF3C7' },
] as const;

export type FabIconId = typeof FAB_ICON_OPTIONS[number]['id'];

export const getFabIconOption = (id?: string) => (
    FAB_ICON_OPTIONS.find((option) => option.id === id) || FAB_ICON_OPTIONS[0]
);
