import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { sdmService, AttendanceStatus, Karyawan } from '../../services/sdm';
import { useActiveKaryawan } from '../../hooks/useSDM';
import { getTodayString } from '../../utils/format';
import { getErrorMessage } from '../../utils/error';
import { appAlert } from '../../utils/appAlert';

// Pilihan cepat per karyawan. TIDAK_HADIR disimpan sebagai ALPHA.
const PILIHAN: { value: AttendanceStatus | 'TIDAK_HADIR'; label: string }[] = [
    { value: 'HADIR', label: 'Hadir' },
    { value: 'TIDAK_HADIR', label: 'Tidak hadir' },
    { value: 'IZIN', label: 'Izin' },
    { value: 'SAKIT', label: 'Sakit' },
    { value: 'CUTI', label: 'Cuti' },
];

const TANGGAL_VALID = /^\d{4}-\d{2}-\d{2}$/;

const keStatus = (pilihan: AttendanceStatus | 'TIDAK_HADIR'): AttendanceStatus =>
    pilihan === 'TIDAK_HADIR' ? 'ALPHA' : pilihan;

const dariStatus = (status: AttendanceStatus | undefined): AttendanceStatus | 'TIDAK_HADIR' | null => {
    if (!status) return null;
    if (status === 'ALPHA') return 'TIDAK_HADIR';
    if (status === 'SETENGAH_HARI') return 'HADIR';
    return status as AttendanceStatus;
};

// Absensi per tanggal: pilih tanggal, lalu centang status tiap karyawan dalam satu layar.
export const AbsensiPerTanggal = () => {
    const [tanggal, setTanggal] = useState(getTodayString());
    const [pilihan, setPilihan] = useState<Record<number, AttendanceStatus | 'TIDAK_HADIR'>>({});
    const [awal, setAwal] = useState<Record<number, AttendanceStatus | 'TIDAK_HADIR'>>({});
    const [loadingTanggal, setLoadingTanggal] = useState(false);
    const [saving, setSaving] = useState(false);

    const { data: karyawanList, isLoading: loadingKaryawan } = useActiveKaryawan();
    const daftar: Karyawan[] = useMemo(() => karyawanList ?? [], [karyawanList]);
    const tanggalValid = TANGGAL_VALID.test(tanggal);

    useEffect(() => {
        if (!tanggalValid) return;
        let batal = false;
        (async () => {
            setLoadingTanggal(true);
            try {
                const hasil = await sdmService.getAbsensiList({ tanggal_dari: tanggal, tanggal_sampai: tanggal, limit: 500 });
                if (batal) return;
                const peta: Record<number, AttendanceStatus | 'TIDAK_HADIR'> = {};
                (hasil?.data ?? []).forEach((abs: any) => {
                    const status = dariStatus(abs.status as AttendanceStatus);
                    if (status) peta[abs.karyawan_id] = status;
                });
                setAwal(peta);
                setPilihan(peta);
            } catch (e) {
                if (!batal) appAlert('Gagal', getErrorMessage(e, 'Gagal memuat absensi tanggal ini'));
            } finally {
                if (!batal) setLoadingTanggal(false);
            }
        })();
        return () => { batal = true; };
    }, [tanggal, tanggalValid]);

    const berubah = daftar.filter((k) => pilihan[k.id] && pilihan[k.id] !== awal[k.id]);

    const simpan = async () => {
        if (berubah.length === 0) {
            appAlert('Info', 'Tidak ada perubahan untuk disimpan.');
            return;
        }
        setSaving(true);
        const gagal: string[] = [];
        for (const k of berubah) {
            const status = keStatus(pilihan[k.id]);
            try {
                await sdmService.bulkClockIn(k.id, [{
                    date: tanggal,
                    status,
                    jam_masuk: status === 'HADIR' ? '08:00' : undefined,
                    jam_keluar: status === 'HADIR' ? '17:00' : undefined,
                }]);
            } catch (e) {
                gagal.push(`${k.nama}: ${getErrorMessage(e, 'gagal')}`);
            }
        }
        setSaving(false);
        if (gagal.length === 0) {
            setAwal({ ...pilihan });
            appAlert('Berhasil', `Absensi ${berubah.length} karyawan tanggal ${tanggal} tersimpan.`);
        } else {
            appAlert('Sebagian gagal', gagal.join('\n'));
        }
    };

    return (
        <View className="gap-4">
            <Card className="p-4 gap-3">
                <Typography weight="bold" className="text-textMain text-sm">Tanggal absensi</Typography>
                <View className="flex-row gap-2 items-end">
                    <View className="flex-1">
                        <Input value={tanggal} onChangeText={setTanggal} placeholder="YYYY-MM-DD" maxLength={10} />
                    </View>
                    <Button title="Hari ini" variant="outline" size="sm" onPress={() => setTanggal(getTodayString())} />
                </View>
                {!tanggalValid && <Typography className="text-rose-600 text-xs">Format tanggal YYYY-MM-DD.</Typography>}
            </Card>

            {(loadingKaryawan || loadingTanggal) ? (
                <ActivityIndicator />
            ) : daftar.length === 0 ? (
                <Typography className="text-textGray text-sm">Belum ada karyawan aktif.</Typography>
            ) : (
                daftar.map((k) => (
                    <Card key={k.id} className="p-4 gap-2">
                        <Typography weight="bold" className="text-textMain text-sm">{k.nama}</Typography>
                        <View className="flex-row flex-wrap gap-2">
                            {PILIHAN.map((p) => {
                                const aktif = pilihan[k.id] === p.value;
                                return (
                                    <Pressable
                                        key={p.value}
                                        onPress={() => setPilihan((prev) => ({ ...prev, [k.id]: p.value }))}
                                        className={`px-3 py-2 rounded-full border ${aktif ? 'bg-primary border-primary' : 'bg-background border-transparent'}`}
                                    >
                                        <Typography className={`text-xs font-bold ${aktif ? 'text-white' : 'text-textGray'}`}>{p.label}</Typography>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </Card>
                ))
            )}

            <Button
                title={saving ? 'Menyimpan…' : `Simpan perubahan (${berubah.length})`}
                onPress={simpan}
                disabled={!tanggalValid || saving || berubah.length === 0}
                loading={saving}
            />
        </View>
    );
};
