import React from 'react';
import { View } from 'react-native';
import { Typography } from '../ui/Typography';
import { FinancialRow } from '../ui/FinancialRow';
import { KasArusJenis, KasJenisDetail } from '../../types/reports';

const JENIS_LABELS: Record<string, string> = {
    CASH: 'Kas Tunai (Lama)',
    BANK_BCA: 'BCA (Lama)',
    BANK_MANDIRI: 'Mandiri (Lama)',
    BANK_BRI: 'BRI (Lama)',
    BANK_LAINNYA: 'Bank Lainnya (Lama)',
    KAS_UTAMA: 'Kas Kantor Utama',
    BANK_UTAMA: 'Bank Utama (BCA)',
    KAS_UNIT_BENGKEL: 'Bengkel (Cash)',
    KAS_UNIT_JASA_ANGKUT: 'Jasa Angkut (Cash)',
    KAS_UNIT_MOBIL: 'Mobil (Cash)',
};

export const kasJenisLabel = (jenis: string) =>
    JENIS_LABELS[jenis] || jenis.replace(/_/g, ' ');

/** Saldo per jenis akun (snapshot). Sembunyikan akun bersaldo nol. */
export function KasJenisBreakdown({ details }: { details?: KasJenisDetail[] }) {
    const rows = (details || []).filter(d => Number(d.saldo || 0) !== 0);
    if (rows.length === 0) return null;
    return (
        <View className="w-full pl-3 mt-1">
            <Typography variant="caption" weight="bold" className="text-slate-400 uppercase tracking-widest text-[10px] mb-1">
                Per Akun Keuangan
            </Typography>
            {rows.map((d, i) => (
                <FinancialRow key={`${d.jenis}-${i}`} label={kasJenisLabel(d.jenis)} value={d.saldo} small indent />
            ))}
        </View>
    );
}

/** Arus kas per jenis akun selama periode (info). Sembunyikan akun tanpa mutasi. */
export function KasArusJenisBreakdown({ flows }: { flows?: KasArusJenis[] }) {
    const rows = (flows || []).filter(f => Number(f.masuk || 0) !== 0 || Number(f.keluar || 0) !== 0);
    if (rows.length === 0) return null;
    return (
        <View className="w-full mt-1">
            {rows.map((f, i) => (
                <View key={`${f.jenis}-${i}`} className="mb-1">
                    <FinancialRow label={kasJenisLabel(f.jenis)} value={f.net} small bold />
                    <View className="pl-4">
                        {(f.masuk || 0) !== 0 && <FinancialRow label="Masuk" value={f.masuk} small indent />}
                        {(f.keluar || 0) !== 0 && <FinancialRow label="Keluar" value={f.keluar} small indent isNegative />}
                    </View>
                </View>
            ))}
        </View>
    );
}
