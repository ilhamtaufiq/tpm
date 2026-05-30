import React, { useState, useEffect } from 'react';
import {
    View,
    Modal,
    Pressable,
    ScrollView,
    ActivityIndicator,
    Dimensions,
    SafeAreaView,
    Share,
    Platform
} from 'react-native';
import {
    X,
    Wallet,
    Wrench,
    Truck,
    Calendar,
    Hash,
    User,
    Info,
    ArrowRight,
    Printer,
    Share2,
    CheckCircle2,
    Clock,
    AlertCircle,
    ArrowUpRight,
    ArrowDownRight,
    Car
} from 'lucide-react-native';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Typography } from './ui/Typography';
import { Badge } from './ui/Badge';
import { formatCurrency } from '../utils/format';
import { keuanganService, ActivityItem } from '../services/keuangan';
import { bengkelService } from '../services/bengkel';
import { jasaAngkutService } from '../services/jasaAngkut';
import { sdmService } from '../services/sdm';
import { mobilService } from '../services/mobil';
import { FILE_URL } from '../utils/api';
import { AlertDialog } from './ui/AlertDialog';
import * as Linking from 'expo-linking';
import { printSettingsService, PrintSettings } from '../utils/printSettings';
import { printReceipt, PrintReceiptData, saveReceiptPDF } from '../utils/printReceipt';
import { useAuthStore } from '../store/useAuthStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TransactionDetailModalProps {
    item: ActivityItem | null;
    visible: boolean;
    onClose: () => void;
}

const DetailRow = ({ label, value, icon: Icon, color = '#6B7280' }: { label: string, value: string, icon?: any, color?: string }) => (
    <View className="flex-row items-center justify-between py-4 border-b border-gray-50">
        <View className="flex-row items-center space-x-3">
            {Icon && (
                <View style={{ backgroundColor: `${color}10` }} className="w-8 h-8 rounded-xl items-center justify-center mr-3">
                    <Icon size={16} color={color} strokeWidth={2.5} />
                </View>
            )}
            <Typography variant="caption" className="text-gray-400 font-bold tracking-widest uppercase">{label}</Typography>
        </View>
        <Typography variant="body2" weight="bold" className="text-text flex-1 text-right ml-4">{value}</Typography>
    </View>
);

const BentoSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <View className="bg-white rounded-[32px] p-6 mb-4 shadow-sm border border-gray-50/50">
        <Typography className="text-primary text-[10px] font-bold tracking-[2px] uppercase mb-4 opacity-50">{title}</Typography>
        {children}
    </View>
);

export const TransactionDetailModal = ({ item, visible, onClose }: TransactionDetailModalProps) => {
    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState<any>(null);
    const [subDetails, setSubDetails] = useState<any>(null);
    const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
    const [printing, setPrinting] = useState(false);
    const user = useAuthStore(state => state.user);
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type: 'alert' | 'confirm';
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert'
    });

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const s = await printSettingsService.getSettings();
                setPrintSettings(s);
            } catch (e) {
                console.error('Failed to load print settings', e);
            }
        };
        loadSettings();
    }, []);

    useEffect(() => {
        if (!visible) {
            setDetails(null);
            setSubDetails(null);
            return;
        }

        const fetchDetails = async () => {
            if (visible && item) {
                setLoading(true);
                setDetails(null);
                setSubDetails(null);
                try {
                    let data;
                    const id = item.original_id;
                    const subtitle = (item.subtitle || '').toUpperCase();

                    // 1. Route by transaction prefix first (most reliable)
                    if (subtitle.startsWith('PTG')) {
                        data = await keuanganService.getPiutang(id);
                    } else if (subtitle.startsWith('HTG')) {
                        data = await keuanganService.getHutang(id);
                    } 
                    // 2. Route by type and source
                    else if (item.type === 'financial') {
                        data = await keuanganService.getKasBankTransaction(id);
                        
                        // Fetch Sub-Details if reference exists
                        if (data.referensi_id) {
                            try {
                                const source = data.sumber;
                                const refId = data.referensi_id;
                                
                                if (source === 'KASBON') {
                                    const kasbon = await sdmService.getKasbon(refId);
                                    setSubDetails({ type: 'kasbon', ...kasbon });
                                } else if (source === 'GAJI') {
                                    const slip = await sdmService.getSlipGaji(refId);
                                    setSubDetails({ type: 'slip_gaji', ...slip });
                                } else if (source === 'PIUTANG') {
                                    const piutang = await keuanganService.getPiutang(refId);
                                    setSubDetails({ type: 'piutang', ...piutang });
                                } else if (source === 'HUTANG') {
                                    const hutang = await keuanganService.getHutang(refId);
                                    setSubDetails({ type: 'hutang', ...hutang });
                                } else if (source === 'JUAL_BELI_MOBIL' || source === 'PEMBELIAN_MOBIL') {
                                    if (data.nomor_referensi?.startsWith('PJL') || data.nomor_referensi?.startsWith('MBL')) {
                                        const penjualan = await mobilService.getPenjualanMobil(refId);
                                        setSubDetails({ type: 'penjualan_mobil', ...penjualan });
                                    } else {
                                        const mobil = await mobilService.getMobil(refId);
                                        setSubDetails({ type: 'pembelian_mobil', ...mobil });
                                    }
                                } else if (source === 'BENGKEL' || source === 'PEMBELIAN_PART') {
                                    const bengkel = await bengkelService.getDetailTransaksi(refId);
                                    setSubDetails({ type: 'workshop', ...bengkel });
                                } else if (source === 'JASA_ANGKUT') {
                                    const muatan = await jasaAngkutService.getMuatan(refId);
                                    setSubDetails({ type: 'logistics', ...muatan });
                                }
                            } catch (subErr) {
                                console.log('Error fetching sub-details:', subErr);
                            }
                        }
                    } else if (item.source === 'jasa_angkut' || item.source === 'JASA_ANGKUT') {
                        data = await jasaAngkutService.getMuatan(id);
                        setDetails(data);
                    } else if (item.type === 'workshop' || item.source === 'BENGKEL' || item.source === 'bengkel') {
                        data = await bengkelService.getDetailTransaksi(id);
                        setDetails(data);
                    } else {
                        data = await keuanganService.getKasBankTransaction(id);
                        setDetails(data);
                    }
                    setDetails(data);
                } catch (error) {
                    console.error('Failed to fetch transaction details:', error);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchDetails();
    }, [visible, item]);

    const handleShareLink = async () => {
        if (!item) return;

        const type = (item.source === 'jasa_angkut' || item.source === 'JASA_ANGKUT') ? 'jasa_angkut' :
            (item.type === 'workshop' || item.source === 'bengkel' || item.source === 'BENGKEL') ? 'bengkel' : null;

        if (!type) {
            setDialogConfig({
                visible: true,
                title: 'Info',
                message: 'Struk publik tidak tersedia untuk tipe transaksi ini.',
                variant: 'info',
                type: 'alert'
            });
            return;
        }

        const shareUrl = `${FILE_URL}/api/v1/public/receipt/view/${type}/${item.original_id}`;
        const shareMessage = `Halo, ini adalah rincian transaksi Anda di Tiga Putra Motor: ${shareUrl}`;

        try {
            if (Platform.OS === 'web' && !navigator.share) {
                await navigator.clipboard.writeText(shareMessage);
                setDialogConfig({
                    visible: true,
                    title: 'Berhasil',
                    message: 'Link struk telah disalin ke clipboard.',
                    variant: 'success',
                    type: 'alert'
                });
                return;
            }

            await Share.share({
                message: shareMessage,
                url: shareUrl,
                title: 'Bagikan Struk Digital'
            });
        } catch (error: any) {
            console.error('Error sharing link:', error);
            if (error?.message?.includes('not supported') || Platform.OS === 'web') {
                try {
                    await navigator.clipboard.writeText(shareMessage);
                    setDialogConfig({
                        visible: true,
                        title: 'Berhasil',
                        message: 'Link struk telah disalin ke clipboard.',
                        variant: 'success',
                        type: 'alert'
                    });
                } catch (clipError) {
                    console.error('Clipboard fallback failed:', clipError);
                }
            }
        }
    };

    const handlePrintThermal = async () => {
        if (!item || !details || !printSettings) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: 'Data atau pengaturan cetak belum siap.',
                variant: 'error',
                type: 'alert'
            });
            return;
        }

        try {
            setPrinting(true);
            const sourceKey = item.source?.toUpperCase() || '';
            const type = (sourceKey === 'JASA_ANGKUT') ? 'jasa_angkut' : 'bengkel';

            let receiptData: PrintReceiptData;

            if (type === 'bengkel') {
                receiptData = {
                    type: 'bengkel',
                    transactionNumber: details.nomor_transaksi || details.id.toString(),
                    antrian: details.nomor_antrian || '-',
                    date: new Date(details.created_at || new Date()),
                    customerName: details.customer_nama || details.nama_customer || '-',
                    cashierName: user?.nama || '-',
                    mechanicName: details.mekanik_nama || '-',
                    status: details.status_bayar || 'Belum Lunas',
                    vehiclePlate: details.nomor_plat || '-',
                    vehicleType: details.jenis_kendaraan || '-',
                    services: (details.detail_services || []).map((s: any) => ({
                        description: s.nama_jasa,
                        quantity: 1,
                        unitPrice: Number(s.harga),
                        subtotal: Number(s.harga)
                    })),
                    parts: (details.detail_parts || []).map((p: any) => ({
                        description: p.spare_part_nama || p.spare_part?.nama || 'Sparepart',
                        quantity: p.qty,
                        unitPrice: Number(p.subtotal) / p.qty,
                        subtotal: Number(p.subtotal)
                    })),
                    subtotal: details.subtotal || details.total_biaya || 0,
                    total: details.grand_total || details.total_biaya || 0,
                    discount: details.diskon || 0,
                    paymentMethod: details.metode_bayar || '-',
                    paid: details.total_bayar || 0,
                    change: details.kembalian || 0,
                    notes: details.catatan
                };
            } else {
                // Jasa Angkut
                receiptData = {
                    type: 'jasa_angkut',
                    transactionNumber: details.nomor_transaksi || details.id.toString(),
                    date: new Date(details.tanggal || new Date()),
                    customerName: details.customer_nama || '-',
                    cashierName: user?.nama || '-',
                    status: details.status_bayar || 'Belum Lunas',
                    origin: details.asal || '-',
                    destination: details.tujuan || '-',
                    driverName: details.supir_nama || details.supir?.nama || '-',
                    items: [{
                        description: `Ritase: ${details.asal} - ${details.tujuan}`,
                        quantity: details.ritase || 1,
                        unitPrice: Number(details.pendapatan_kotor) / (details.ritase || 1),
                        subtotal: Number(details.pendapatan_kotor)
                    }],
                    subtotal: Number(details.pendapatan_kotor),
                    total: Number(details.pendapatan_kotor),
                    paymentMethod: 'TRANSFER/TUNAI',
                    paid: details.jumlah_bayar || 0,
                    notes: details.catatan
                };
            }

            await printReceipt(receiptData, printSettings);
        } catch (error: any) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: error.message || 'Gagal mencetak struk thermal',
                variant: 'error',
                type: 'alert'
            });
        } finally {
            setPrinting(false);
        }
    };

    if (!item) return null;

    const renderFinancialDetail = () => {
        const renderFinancialSubDetails = () => {
            if (!subDetails) return null;

            switch (subDetails.type) {
                case 'kasbon':
                    return (
                        <BentoSection title="Detail Kasbon">
                            <DetailRow label="Karyawan" value={subDetails.karyawan_nama || '-'} icon={User} color="#8B5CF6" />
                            <DetailRow label="Status" value={subDetails.status} color={subDetails.status === 'LUNAS' ? '#10B981' : '#F59E0B'} />
                        </BentoSection>
                    );
                case 'slip_gaji':
                    return (
                        <BentoSection title="Detail Gaji">
                            <DetailRow label="Karyawan" value={subDetails.karyawan_nama || '-'} icon={User} color="#8B5CF6" />
                            <DetailRow label="Periode" value={`M-${subDetails.periode_minggu} / ${subDetails.periode_tahun}`} icon={Calendar} color="#3B82F6" />
                            <DetailRow label="Gaji Bersih" value={formatCurrency(subDetails.gaji_bersih)} color="#10B981" />
                        </BentoSection>
                    );
                case 'piutang':
                case 'hutang':
                    const isPiutang = subDetails.type === 'piutang';
                    return (
                        <BentoSection title={isPiutang ? "Detail Pelunasan Piutang" : "Detail Pelunasan Hutang"}>
                            <DetailRow label={isPiutang ? "Debitur" : "Kreditur"} value={subDetails.nama_debitur || subDetails.nama_kreditur || '-'} icon={User} color="#8B5CF6" />
                            <DetailRow label="Total" value={formatCurrency(subDetails.nominal_piutang || subDetails.nominal_hutang)} color="#3B82F6" />
                            <DetailRow label="Sisa" value={formatCurrency(subDetails.sisa_piutang || subDetails.sisa_hutang)} color="#EF4444" />
                        </BentoSection>
                    );
                case 'penjualan_mobil':
                    return (
                        <BentoSection title="Detail Penjualan Mobil">
                            <DetailRow label="Unit" value={subDetails.mobil_nama || subDetails.mobil?.nama || subDetails.mobil_info || '-'} icon={Car} color="#3B82F6" />
                            <DetailRow label="Customer" value={subDetails.customer_nama || subDetails.nama_pembeli || '-'} icon={User} color="#F59E0B" />
                            <DetailRow label="Harga Jual" value={formatCurrency(subDetails.harga_jual)} color="#10B981" />
                            <DetailRow label="Sisa Bayar" value={formatCurrency(subDetails.sisa_bayar)} color="#EF4444" />
                            <DetailRow label="Status" value={subDetails.status_bayar} color="#6366F1" />
                        </BentoSection>
                    );
                case 'pembelian_mobil':
                    return (
                        <BentoSection title="Detail Pembelian Mobil">
                            <DetailRow label="Unit" value={`${subDetails.merek || subDetails.merk} ${subDetails.model} (${subDetails.tahun})`} icon={Car} color="#3B82F6" />
                            <DetailRow label="Plat" value={subDetails.nomor_plat || '-'} icon={Hash} color="#6366F1" />
                            <DetailRow label="Warna" value={subDetails.warna || '-'} color="#8B5CF6" />
                            <DetailRow label="Mesin" value={subDetails.nomor_mesin || '-'} icon={Hash} color="#6B7280" />
                            <DetailRow label="Rangka" value={subDetails.nomor_rangka || '-'} icon={Hash} color="#6B7280" />
                            <DetailRow label="Harga Beli" value={formatCurrency(subDetails.harga_beli)} color="#EF4444" />
                        </BentoSection>
                    );
                case 'workshop':
                    return (
                        <BentoSection title="Detail Bengkel">
                            <DetailRow label="Unit" value={`${subDetails.plat_nomor} - ${subDetails.tipe_motor || ''}`} icon={Car} color="#3B82F6" />
                            <DetailRow label="Customer" value={subDetails.nama_customer || '-'} icon={User} color="#F59E0B" />
                            <DetailRow label="Mekanik" value={subDetails.mekanik_nama || '-'} icon={User} color="#8B5CF6" />
                            <DetailRow label="Kilometer" value={subDetails.kilometer ? `${subDetails.kilometer} KM` : '-'} icon={Hash} color="#6366F1" />
                            <DetailRow label="Status" value={subDetails.status_pengerjaan} color="#6366F1" />
                        </BentoSection>
                    );
                default:
                    return null;
            }
        };

        const isPiutang = item.subtitle?.startsWith('PTG') || !!details?.nomor_piutang;
        const isHutang = item.subtitle?.startsWith('HTG') || !!details?.nomor_hutang;

        // Determine Account display name
        let accountName = '-';
        if (details?.jenis) {
            accountName = details.jenis.replace('BANK_', '').replace('KAS_', '').replace('_', ' ');
        } else if (details?.unit) {
            accountName = details.unit.replace('_', ' ');
        } else if (item.status && item.type === 'financial') {
            accountName = item.status.replace('BANK_', '').replace('KAS_', '').replace('_', ' ');
        }

        // Determine Type display name
        let typeName = '-';
        if (isPiutang) {
            typeName = 'Pemberian Piutang';
        } else if (isHutang) {
            typeName = 'Penerimaan Hutang';
        } else if (details?.tipe) {
            typeName = details.tipe === 'MASUK' ? 'Kas Masuk' : 'Kas Keluar';
        } else {
            typeName = item.is_incoming ? 'Kas Masuk' : 'Kas Keluar';
        }

        return (
            <>
                <BentoSection title="Aliran Kas">
                    <DetailRow label="Akun" value={accountName} icon={Wallet} color="#3B82F6" />
                    <DetailRow 
                        label="Tipe" 
                        value={typeName} 
                        icon={isPiutang || isHutang || details?.tipe === 'MASUK' || item.is_incoming ? ArrowUpRight : ArrowDownRight} 
                        color={isPiutang || isHutang || details?.tipe === 'MASUK' || item.is_incoming ? '#10B981' : '#EF4444'} 
                    />
                    <DetailRow label="Sumber" value={details?.sumber || item.source || '-'} icon={Info} color="#6366F1" />
                    {(details?.nomor_referensi || details?.nama_debitur || details?.nama_kreditur) && (
                        <DetailRow 
                            label={isPiutang ? "Debitur" : isHutang ? "Kreditur" : "No. Ref"} 
                            value={details?.nama_debitur || details?.nama_kreditur || details?.nomor_referensi} 
                            icon={isPiutang || isHutang ? User : Hash} 
                            color="#F59E0B" 
                        />
                    )}
                </BentoSection>

                {renderFinancialSubDetails()}

                {(details?.keterangan || details?.catatan) && (
                    <BentoSection title="Keterangan">
                        <Typography variant="body2" className="text-textGray leading-6">
                            {details?.keterangan || details?.catatan || '-'}
                        </Typography>
                    </BentoSection>
                )}
            </>
        );
    };

    const renderWorkshopDetail = () => (
        <>
            <BentoSection title="Data Kendaraan">
                <DetailRow label="Plat Nomor" value={details?.nomor_plat || details?.plat_nomor || '-'} icon={Hash} color="#3B82F6" />
                <DetailRow label="Tipe Unit" value={details?.jenis_kendaraan || details?.tipe_motor || '-'} icon={Car} color="#6366F1" />
                <DetailRow label="Customer" value={details?.nama_customer || details?.customer_nama || '-'} icon={User} color="#F59E0B" />
                <DetailRow label="Mekanik" value={details?.mekanik_nama || '-'} icon={User} color="#8B5CF6" />
                <DetailRow label="Kilometer" value={details?.kilometer ? `${details.kilometer} KM` : '-'} icon={Hash} color="#6366F1" />
            </BentoSection>

            {(details?.detail_parts?.length > 0 || details?.detail_services?.length > 0) && (
                <BentoSection title="Item & Jasa">
                    {details?.detail_parts?.map((part: any, idx: number) => (
                        <View key={`part-${idx}`} className="flex-row justify-between items-start py-3 border-b border-gray-50">
                            <View className="flex-1">
                                <Typography variant="body2" weight="bold">{part.spare_part?.nama || 'Sparepart'}</Typography>
                                <Typography variant="caption" className="text-gray-400 mt-0.5">{part.qty} x {formatCurrency(part.harga_jual)}</Typography>
                            </View>
                            <Typography variant="body2" weight="bold">{formatCurrency(part.subtotal)}</Typography>
                        </View>
                    ))}
                    {details?.detail_services?.map((service: any, idx: number) => (
                        <View key={`service-${idx}`} className="flex-row justify-between items-start py-3 border-b border-gray-50 last:border-0">
                            <View className="flex-1">
                                <Typography variant="body2" weight="bold">{service.nama_jasa}</Typography>
                                <Typography variant="caption" className="text-gray-400 mt-0.5">{service.qty} x {formatCurrency(service.harga)}</Typography>
                            </View>
                            <Typography variant="body2" weight="bold">{formatCurrency(service.subtotal)}</Typography>
                        </View>
                    ))}
                    <View className="flex-row justify-between mt-4">
                        <Typography variant="body2" weight="bold" className="text-primary">Subtotal</Typography>
                        <Typography variant="body2" weight="bold" className="text-primary">{formatCurrency(details?.subtotal)}</Typography>
                    </View>
                    {details?.diskon > 0 && (
                        <View className="flex-row justify-between mt-1">
                            <Typography variant="body2" className="text-rose-500">Diskon</Typography>
                            <Typography variant="body2" className="text-rose-500">-{formatCurrency(details?.diskon)}</Typography>
                        </View>
                    )}
                </BentoSection>
            )}
        </>
    );

    const renderLogisticsDetail = () => (
        <>
            <BentoSection title="Rute & Armada">
                <View className="flex-row items-center mb-6 bg-gray-50 p-4 rounded-2xl">
                    <View className="flex-1">
                        <Typography variant="caption" className="text-gray-400 font-bold mb-1">ASAL</Typography>
                        <Typography variant="body2" weight="bold">{details?.asal || '-'}</Typography>
                    </View>
                    <View className="px-4">
                        <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                            <ArrowRight size={14} color="#023C69" />
                        </View>
                    </View>
                    <View className="flex-1 items-end">
                        <Typography variant="caption" className="text-gray-400 font-bold mb-1">TUJUAN</Typography>
                        <Typography variant="body2" weight="bold" className="text-right">{details?.tujuan || '-'}</Typography>
                    </View>
                </View>
                <DetailRow label="Driver" value={details?.supir_nama || details?.supir_nama_manual || '-'} icon={User} color="#8B5CF6" />
                <DetailRow label="Armada" value={details?.info_kendaraan || '-'} icon={Truck} color="#10B981" />
                <DetailRow label="Muatan" value={`${details?.jenis_muatan || '-'} (${details?.berat_muatan || '-'})`} icon={Info} color="#6366F1" />
                <DetailRow label="Ritase" value={`${details?.ritase || 1} Rit`} icon={Hash} color="#F59E0B" />
            </BentoSection>

            <BentoSection title="Rincian Biaya Operasional">
                <DetailRow label="BBM" value={formatCurrency(details?.biaya_bbm)} color="#EF4444" />
                <DetailRow label="Tol" value={formatCurrency(details?.biaya_tol)} color="#EF4444" />
                <DetailRow label="Uang Makan" value={formatCurrency(details?.biaya_makan)} color="#EF4444" />
                <DetailRow label="Lainnya" value={formatCurrency((details?.biaya_parkir || 0) + (details?.biaya_lainnya || 0))} color="#EF4444" />
            </BentoSection>

            <BentoSection title="Rincian Margin">
                <DetailRow label="Pendapatan Kotor" value={formatCurrency(details?.pendapatan_kotor)} color="#3B82F6" />
                <DetailRow label="Total Biaya Ops" value={formatCurrency(details?.total_biaya)} color="#EF4444" />
                <DetailRow label="Laba Driver" value={formatCurrency(details?.laba_supir)} color="#F59E0B" />
                <View className="mt-4 pt-4 border-t border-gray-100 flex-row justify-between items-center">
                    <Typography weight="bold" className="text-primary">Margin Usaha (TPM)</Typography>
                    <Typography weight="bold" className="text-emerald-600 text-xl tracking-tighter">
                        {formatCurrency(details?.laba_tpm)}
                    </Typography>
                </View>
            </BentoSection>
        </>
    );

    const getStatusConfig = (status: string) => {
        const s = status.toUpperCase();
        if (s.includes('LUNAS') || s === 'SELESAI' || s === 'MASUK') {
            return { color: '#10B981', icon: CheckCircle2, label: s };
        }
        if (s.includes('PROSES') || s === 'ANTRE') {
            return { color: '#3B82F6', icon: Clock, label: s };
        }
        if (s.includes('BELUM') || s === 'PENDING' || s === 'KELUAR') {
            return { color: '#F59E0B', icon: AlertCircle, label: s };
        }
        return { color: '#6B7280', icon: Info, label: s };
    };

    const statusConfig = getStatusConfig(item.status);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={Platform.OS !== 'android'}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/60 justify-end">
                <View
                    className="bg-[#F8F9FA] rounded-t-[48px] overflow-hidden"
                    style={{ height: SCREEN_HEIGHT * 0.9 }}
                >
                    {/* Header */}
                    <View className="px-8 pt-10 pb-6 flex-row items-center justify-between">
                        <View>
                            <Typography variant="caption" className="text-gray-400 font-bold tracking-[3px] uppercase">Detail Transaksi</Typography>
                            <Typography variant="h2" weight="bold" className="text-text tracking-tighter mt-1">
                                {details?.nomor_transaksi || item.ref_number || item.id}
                            </Typography>
                        </View>
                        <Pressable
                            onPress={onClose}
                            className="bg-white w-12 h-12 rounded-2xl items-center justify-center shadow-sm border border-gray-100"
                        >
                            <X size={20} color="#121212" />
                        </Pressable>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 220 }}
                    >
                        {loading ? (
                            <View className="py-20 items-center justify-center">
                                <ActivityIndicator size="large" color="#023C69" />
                                <Typography className="mt-4 text-textGray/40 font-bold tracking-[4px] uppercase text-[10px]">Menarik Data...</Typography>
                            </View>
                        ) : (
                            <View>
                                {/* Summary Card */}
                                <View className="bg-primary rounded-[40px] p-8 mb-6 shadow-2xl relative overflow-hidden">
                                    <View className="absolute -right-10 -top-10 bg-white/5 w-48 h-48 rounded-full" />
                                    <View className="flex-row justify-between items-start mb-8">
                                        <View>
                                            <Typography className="text-white/50 text-[10px] font-bold tracking-widest uppercase mb-1">Jumlah Transaksi</Typography>
                                            <Typography weight="bold" className="text-white text-3xl tracking-tighter">
                                                {formatCurrency(item.amount)}
                                            </Typography>
                                        </View>
                                        <View
                                            style={{ backgroundColor: `${statusConfig.color}20` }}
                                            className="px-4 py-2 rounded-full border border-white/10"
                                        >
                                            <Typography className="text-[9px] font-bold tracking-widest uppercase" style={{ color: statusConfig.color }}>
                                                {statusConfig.label}
                                            </Typography>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center">
                                        <Calendar size={14} color="rgba(255,255,255,0.4)" />
                                        <Typography className="text-white/60 text-xs font-medium ml-2">
                                            {format(new Date(item.timestamp), 'dd MMMM yyyy • HH:mm', { locale: localeID })}
                                        </Typography>
                                    </View>
                                </View>

                                {/* Dynamic Content */}
                                {((item.type === 'financial' || item.subtitle?.startsWith('PTG') || item.subtitle?.startsWith('HTG'))) ? renderFinancialDetail() :
                                    (item.source === 'jasa_angkut' || item.source === 'JASA_ANGKUT') ? renderLogisticsDetail() :
                                        (item.type === 'workshop' || item.source === 'bengkel' || item.source === 'BENGKEL') ? renderWorkshopDetail() :
                                            renderFinancialDetail()}

                                {((item.source === 'jasa_angkut' || item.source === 'JASA_ANGKUT' || item.type === 'workshop' || item.source === 'bengkel' || item.source === 'BENGKEL')) && (
                                    <View className="flex-row gap-4 mt-4">
                                        <Pressable
                                            onPress={handleShareLink}
                                            className="flex-1 flex-row items-center justify-center bg-white h-14 rounded-2xl border border-gray-100 shadow-sm"
                                        >
                                            <Share2 size={18} color="#00ADEF" />
                                            <Typography weight="bold" className="text-[#00ADEF] ml-2">Bagikan Link</Typography>
                                        </Pressable>
                                        <Pressable
                                            onPress={handlePrintThermal}
                                            disabled={printing}
                                            className="flex-1 flex-row items-center justify-center bg-primary h-14 rounded-2xl shadow-lg shadow-primary/30"
                                        >
                                            {printing ? <ActivityIndicator color="white" size="small" /> : (
                                                <>
                                                    <Printer size={18} color="white" />
                                                    <Typography weight="bold" className="text-white ml-2">Cetak Struk</Typography>
                                                </>
                                            )}
                                        </Pressable>
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>

                    {/* Bottom Button */}
                    {!loading && (
                        <SafeAreaView className="absolute bottom-10 left-8 right-8">
                            <Pressable
                                onPress={onClose}
                                style={({ pressed }) => ({
                                    opacity: pressed ? 0.9 : 1
                                })}
                                className="bg-primary h-16 rounded-[24px] flex-row items-center justify-center shadow-2xl"
                            >
                                <Typography weight="bold" className="text-white text-base">Tutup Detail</Typography>
                            </Pressable>
                        </SafeAreaView>
                    )}
                </View>
            </View>
            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
            />
        </Modal>
    );
};
