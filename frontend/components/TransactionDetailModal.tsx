import React, { useState, useEffect } from 'react';
import {
    View,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Dimensions,
    SafeAreaView
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

    useEffect(() => {
        const fetchDetails = async () => {
            if (visible && item) {
                setLoading(true);
                try {
                    let data;
                    const id = item.original_id;

                    if (item.source === 'jasa_angkut') {
                        data = await jasaAngkutService.getMuatan(id);
                    } else if (item.type === 'workshop') {
                        data = await bengkelService.getDetailTransaksi(id);
                    } else {
                        data = await keuanganService.getKasBankTransaction(id);
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

    if (!item) return null;

    const renderFinancialDetail = () => (
        <>
            <BentoSection title="Aliran Kas">
                <DetailRow label="Akun" value={details?.jenis?.replace('BANK_', '') || '-'} icon={Wallet} color="#3B82F6" />
                <DetailRow label="Tipe" value={details?.tipe === 'MASUK' ? 'Kas Masuk' : 'Kas Keluar'} icon={details?.tipe === 'MASUK' ? ArrowUpRight : ArrowDownRight} color={details?.tipe === 'MASUK' ? '#10B981' : '#EF4444'} />
                <DetailRow label="Sumber" value={details?.sumber || '-'} icon={Info} color="#6366F1" />
                {details?.nomor_referensi && (
                    <DetailRow label="No. Ref" value={details.nomor_referensi} icon={Hash} color="#F59E0B" />
                )}
            </BentoSection>

            {(details?.keterangan || details?.catatan) && (
                <BentoSection title="Keterangan">
                    <Typography variant="body2" className="text-textGray leading-6">
                        {details?.keterangan || details?.catatan || '-'}
                    </Typography>
                </BentoSection>
            )}
        </>
    );

    const renderWorkshopDetail = () => (
        <>
            <BentoSection title="Data Kendaraan">
                <DetailRow label="Plat Nomor" value={details?.nomor_plat || '-'} icon={Hash} color="#3B82F6" />
                <DetailRow label="Tipe Unit" value={details?.jenis_kendaraan || '-'} icon={Car} color="#6366F1" />
                <DetailRow label="Customer" value={details?.nama_customer || '-'} icon={User} color="#F59E0B" />
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
            transparent={true}
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
                        <TouchableOpacity
                            onPress={onClose}
                            className="bg-white w-12 h-12 rounded-2xl items-center justify-center shadow-sm border border-gray-100"
                        >
                            <X size={20} color="#121212" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 160 }}
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
                                {item.source === 'jasa_angkut' ? renderLogisticsDetail() :
                                    item.type === 'workshop' ? renderWorkshopDetail() :
                                        renderFinancialDetail()}

                                {/* Action Footer */}
                                <View className="flex-row gap-4 mt-4">
                                    <TouchableOpacity className="flex-1 flex-row items-center justify-center bg-white h-14 rounded-2xl border border-gray-100 shadow-sm">
                                        <Share2 size={18} color="#023C69" />
                                        <Typography weight="bold" className="text-primary ml-2">Bagikan</Typography>
                                    </TouchableOpacity>
                                    <TouchableOpacity className="flex-1 flex-row items-center justify-center bg-white h-14 rounded-2xl border border-gray-100 shadow-sm">
                                        <Printer size={18} color="#023C69" />
                                        <Typography weight="bold" className="text-primary ml-2">Cetak</Typography>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Bottom Button */}
                    {!loading && (
                        <SafeAreaView className="absolute bottom-10 left-8 right-8">
                            <TouchableOpacity
                                onPress={onClose}
                                className="bg-primary h-16 rounded-[24px] flex-row items-center justify-center shadow-2xl"
                                activeOpacity={0.9}
                            >
                                <Typography weight="bold" className="text-white text-base">Tutup Detail</Typography>
                            </TouchableOpacity>
                        </SafeAreaView>
                    )}
                </View>
            </View>
        </Modal>
    );
};
