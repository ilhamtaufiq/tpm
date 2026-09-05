import React, { useMemo } from 'react';
import { View, Image, Platform } from 'react-native';
import { Typography } from '../ui/Typography';
import { ReceiptQRCode } from '../ui/ReceiptQRCode';
import { formatCurrency } from '../../utils/format';
import { FILE_URL } from '../../utils/api';
import { Car, MapPin, User, Wrench, Package } from 'lucide-react-native';

export interface PublicReceiptItem {
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface PublicReceiptData {
    transactionNumber: string;
    date: string;
    customerName: string;
    vehiclePlate?: string;
    vehicleType?: string;
    items?: PublicReceiptItem[];
    services?: PublicReceiptItem[];
    parts?: PublicReceiptItem[];
    details?: string[];
    subtotal: number;
    tax?: number;
    discount?: number;
    showDiscount?: boolean;
    total: number;
    paid?: number;
    remaining?: number;
    paymentMethod?: string | null;
    paymentMethods?: { metode: string; nominal: number }[];
    notes?: string;
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    customHeader?: string;
    customFooter?: string;
    customLogo?: string;
    showQRCode?: boolean;
    paperSize?: string;
    origin?: string;
    destination?: string;
    driverName?: string;
}

interface PublicReceiptCardProps {
    receipt: PublicReceiptData;
    receiptType: 'bengkel' | 'jasa_angkut' | 'mobil';
    shareUrl?: string;
    /** Use static QR image so html2canvas capture matches on-screen design */
    captureMode?: boolean;
}

const mono = { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' } as const;

function Divider() {
    return (
        <View
            className="my-4"
            style={{ borderBottomWidth: 1, borderBottomColor: '#E5E7EB', borderStyle: 'dashed' }}
        />
    );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <View className="flex-row justify-between items-start mb-2 gap-3">
            <Typography className="text-gray-500 text-xs flex-shrink-0" style={mono}>{label}</Typography>
            <Typography
                weight={bold ? 'bold' : 'medium'}
                className="text-gray-900 text-xs text-right flex-1"
                style={mono}
                numberOfLines={3}
            >
                {value}
            </Typography>
        </View>
    );
}

function ItemBlock({
    title,
    items,
    icon: Icon,
    accent,
}: {
    title: string;
    items: PublicReceiptItem[];
    icon: typeof Wrench;
    accent: string;
}) {
    if (!items.length) return null;
    return (
        <View className="mb-4">
            <View className="flex-row items-center mb-3">
                <View className="w-7 h-7 rounded-lg items-center justify-center mr-2" style={{ backgroundColor: `${accent}18` }}>
                    <Icon size={14} color={accent} />
                </View>
                <Typography weight="bold" className="text-[10px] uppercase tracking-widest text-gray-500">
                    {title}
                </Typography>
            </View>
            {items.map((item, index) => (
                <View key={`${title}-${index}`} className="mb-3 pl-1">
                    <Typography weight="bold" className="text-sm text-gray-900 mb-1" style={mono}>
                        {String(item.description || '-').toUpperCase()}
                    </Typography>
                    <View className="flex-row justify-between">
                        <Typography className="text-xs text-gray-500" style={mono}>
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                        </Typography>
                        <Typography weight="bold" className="text-xs text-gray-900" style={mono}>
                            {formatCurrency(item.subtotal)}
                        </Typography>
                    </View>
                </View>
            ))}
        </View>
    );
}

function resolveLogoSource(customLogo?: string) {
    if (!customLogo || customLogo === 'tpm_default') {
        return { kind: 'local' as const };
    }
    if (customLogo.startsWith('data:') || customLogo.startsWith('http')) {
        return { kind: 'uri' as const, uri: customLogo };
    }
    if (customLogo.startsWith('/')) {
        return { kind: 'uri' as const, uri: `${FILE_URL}${customLogo}` };
    }
    return { kind: 'local' as const };
}

export function PublicReceiptCard({ receipt, receiptType, shareUrl, captureMode = false }: PublicReceiptCardProps) {
    const paid = Number(receipt.paid || 0);
    const total = Number(receipt.total || 0);
    const remaining = receipt.remaining ?? Math.max(total - paid, 0);
    const isPaid = remaining <= 0;

    const services = receipt.services || [];
    const parts = receipt.parts || [];
    const showBengkelSplit = receiptType === 'bengkel' && (services.length > 0 || parts.length > 0);
    const fallbackItems = showBengkelSplit ? [] : (receipt.items || []);

    const typeLabel = receiptType === 'bengkel' ? 'Bengkel' : receiptType === 'jasa_angkut' ? 'Jasa Angkut' : 'Mobil';
    const logo = resolveLogoSource(receipt.customLogo);

    const formattedDate = useMemo(() => {
        try {
            return new Date(receipt.date).toLocaleString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return receipt.date;
        }
    }, [receipt.date]);

    return (
        <View className="bg-white rounded-[28px] overflow-hidden border border-gray-100 shadow-sm">
            <View className="bg-primary px-5 py-4 flex-row items-center justify-between">
                <View>
                    <Typography className="text-white/70 text-[10px] font-bold uppercase tracking-[2px]">
                        Struk Digital
                    </Typography>
                    <Typography weight="bold" className="text-white text-lg tracking-tight">
                        {typeLabel}
                    </Typography>
                </View>
                <View className="px-3 py-1 rounded-full bg-white/20">
                    <Typography weight="bold" className="text-[10px] text-white uppercase tracking-wider">
                        {isPaid ? 'LUNAS' : 'BELUM LUNAS'}
                    </Typography>
                </View>
            </View>

            <View className="px-5 py-6">
                {receipt.customHeader ? (
                    <Typography className="text-center text-[11px] text-primary font-semibold mb-4 uppercase tracking-wide">
                        {receipt.customHeader}
                    </Typography>
                ) : null}

                <View className="items-center mb-4">
                    {logo.kind === 'local' ? (
                        <Image
                            source={require('../../assets/logo_tpm.png')}
                            style={{ width: 88, height: 64 }}
                            resizeMode="contain"
                        />
                    ) : (
                        <Image source={{ uri: logo.uri }} style={{ width: 88, height: 64 }} resizeMode="contain" />
                    )}
                    <Typography weight="bold" className="text-primary text-xl mt-3 text-center" style={mono}>
                        {receipt.companyName || 'Tiga Putra Motor'}
                    </Typography>
                    {receipt.companyAddress ? (
                        <Typography className="text-gray-500 text-xs text-center mt-1" style={mono}>
                            {receipt.companyAddress}
                        </Typography>
                    ) : null}
                    {receipt.companyPhone ? (
                        <Typography className="text-gray-500 text-xs text-center" style={mono}>
                            Telp: {receipt.companyPhone}
                        </Typography>
                    ) : null}
                </View>

                <Divider />

                <Row label="No. Nota" value={receipt.transactionNumber} bold />
                <Row label="Tanggal" value={formattedDate} />
                <Row label="Pelanggan" value={receipt.customerName || '-'} />

                {receipt.vehiclePlate ? (
                    <View className="flex-row items-center mt-1 mb-1">
                        <Car size={14} color="#023C69" />
                        <Typography className="text-primary text-xs font-bold ml-2" style={mono}>
                            {receipt.vehiclePlate}
                            {receipt.vehicleType ? ` · ${receipt.vehicleType}` : ''}
                        </Typography>
                    </View>
                ) : null}

                {receiptType === 'mobil' && fallbackItems[0] ? (
                    <View className="mt-2 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <View className="flex-row items-center">
                            <Car size={13} color="#64748B" />
                            <Typography className="text-gray-600 text-xs ml-2 flex-1" style={mono}>
                                {fallbackItems[0].description}
                            </Typography>
                        </View>
                    </View>
                ) : null}

                {receiptType === 'jasa_angkut' && (receipt.origin || receipt.destination) ? (
                    <View className="mt-2 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <View className="flex-row items-center mb-1">
                            <MapPin size={13} color="#64748B" />
                            <Typography className="text-gray-600 text-xs ml-2" style={mono}>
                                {receipt.origin || '-'} → {receipt.destination || '-'}
                            </Typography>
                        </View>
                        {receipt.driverName ? (
                            <View className="flex-row items-center">
                                <User size={13} color="#64748B" />
                                <Typography className="text-gray-600 text-xs ml-2" style={mono}>
                                    Sopir: {receipt.driverName}
                                </Typography>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                <Divider />

                {showBengkelSplit ? (
                    <>
                        <ItemBlock title="Jasa" items={services} icon={Wrench} accent="#2563EB" />
                        <ItemBlock title="Sparepart" items={parts} icon={Package} accent="#059669" />
                    </>
                ) : (
                    fallbackItems.map((item, index) => (
                        <View key={index} className="mb-3">
                            <Typography weight="bold" className="text-sm text-gray-900 mb-1" style={mono}>
                                {String(item.description || '-').toUpperCase()}
                            </Typography>
                            <View className="flex-row justify-between">
                                <Typography className="text-xs text-gray-500" style={mono}>
                                    {item.quantity} × {formatCurrency(item.unitPrice)}
                                </Typography>
                                <Typography weight="bold" className="text-xs text-gray-900" style={mono}>
                                    {formatCurrency(item.subtotal)}
                                </Typography>
                            </View>
                        </View>
                    ))
                )}

                {receipt.details?.map((line, index) => (
                    <Typography key={index} className="text-[11px] text-gray-600 mb-1" style={mono}>
                        {line}
                    </Typography>
                ))}

                <Divider />

                <Row label="Subtotal" value={formatCurrency(receipt.subtotal)} />
                {(receipt.tax || 0) > 0 ? <Row label="Pajak" value={formatCurrency(receipt.tax!)} /> : null}
                {(receipt.discount || 0) > 0 && receipt.showDiscount !== false ? (
                    <Row label="Diskon" value={`-${formatCurrency(receipt.discount!)}`} />
                ) : null}

                <View className="flex-row justify-between items-center py-3 px-3 -mx-1 mt-2 rounded-2xl bg-primary/5 border border-primary/10">
                    <Typography weight="bold" className="text-primary text-base" style={mono}>TOTAL</Typography>
                    <Typography weight="bold" className="text-primary text-lg" style={mono}>
                        {formatCurrency(total)}
                    </Typography>
                </View>

                {paid > 0 ? <Row label="Dibayar" value={formatCurrency(paid)} /> : null}
                {!isPaid ? (
                    <Row label="Sisa" value={formatCurrency(remaining)} bold />
                ) : (
                    <View className="items-center mt-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                        <Typography weight="bold" className="text-emerald-700 text-sm tracking-widest" style={mono}>
                            ✓ LUNAS
                        </Typography>
                    </View>
                )}

                {receipt.paymentMethod ? (
                    <>
                        <Row label="Metode Bayar" value={String(receipt.paymentMethod).toUpperCase()} />
                        {(receipt.paymentMethods || []).length > 1
                            ? receipt.paymentMethods!.map((m, i) => (
                                <Row key={i} label={`  · ${String(m.metode).toUpperCase()}`} value={formatCurrency(m.nominal)} />
                            ))
                            : null}
                    </>
                ) : null}

                <Divider />

                <View className="items-center">
                    {receipt.customFooter ? (
                        <Typography className="text-center text-xs text-gray-600 mb-2" style={mono}>
                            {receipt.customFooter}
                        </Typography>
                    ) : null}
                    <Typography className="text-center text-xs text-gray-500" style={mono}>
                        Terima kasih atas kepercayaan Anda
                    </Typography>
                    <Typography className="text-center text-[10px] text-gray-400 mt-2" style={mono}>
                        Bukti transaksi sah · {receipt.companyName || 'Tiga Putra Motor'}
                    </Typography>
                    {receipt.notes ? (
                        <Typography className="text-center text-xs text-gray-500 mt-3 italic" style={mono}>
                            "{receipt.notes}"
                        </Typography>
                    ) : null}
                    {receipt.showQRCode !== false && shareUrl ? (
                        <View className="mt-5 items-center">
                            {captureMode && Platform.OS === 'web' ? (
                                <Image
                                    source={{
                                        uri: `https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(shareUrl)}`,
                                    }}
                                    style={{ width: 96, height: 96 }}
                                    resizeMode="contain"
                                />
                            ) : (
                                <ReceiptQRCode value={shareUrl} size={96} />
                            )}
                            <Typography className="text-[10px] text-gray-400 mt-2 text-center">
                                Scan untuk verifikasi struk
                            </Typography>
                        </View>
                    ) : null}
                </View>
            </View>
        </View>
    );
}