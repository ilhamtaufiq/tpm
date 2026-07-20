import React, { useMemo, useState } from 'react';
import {
    View,
    ScrollView,
    Pressable,
    StatusBar,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import {
    FileSpreadsheet,
    CheckCircle2,
    AlertTriangle,
    Info,
} from 'lucide-react-native';
import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { dataImportService, ImportResult } from '../../services/dataImport';
import { downloadXlsxBlob } from '../../utils/downloadXlsx';
import { getErrorMessage } from '../../utils/error';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';

type PickedFile =
    | File
    | { uri: string; name: string; type: string };

export default function DataImportScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const user = useAuthStore((s) => s.user);
    const { themeColors } = useUIStore();
    const isAdmin = user?.role === 'ADMIN';

    const [busy, setBusy] = useState<'template' | 'preview' | 'commit' | null>(null);
    const [picked, setPicked] = useState<PickedFile | null>(null);
    const [pickedName, setPickedName] = useState<string>('');
    const [preview, setPreview] = useState<ImportResult | null>(null);
    const [commitResult, setCommitResult] = useState<ImportResult | null>(null);
    const [dialog, setDialog] = useState({
        visible: false,
        title: '',
        message: '',
        variant: 'info' as 'success' | 'error' | 'warning' | 'info',
    });

    const totalErrors = useMemo(() => {
        if (!preview) return 0;
        return Object.values(preview.sheets || {}).reduce(
            (n, s) => n + (s.errors?.length || 0),
            0
        );
    }, [preview]);

    if (!isAdmin) {
        return (
            <View className="flex-1 bg-white">
                <Header title="Import Data" showBackButton />
                <View className="flex-1 items-center justify-center p-8">
                    <AlertTriangle size={40} color="#9CA3AF" />
                    <Typography weight="bold" className="mt-4 text-center">
                        Hanya Admin yang dapat mengimpor data.
                    </Typography>
                </View>
            </View>
        );
    }

    const show = (title: string, message: string, variant: typeof dialog.variant) =>
        setDialog({ visible: true, title, message, variant });

    const handleDownloadTemplate = async () => {
        try {
            setBusy('template');
            const data = await dataImportService.downloadTemplate();
            const filename = `TPM_IMPORT_TEMPLATE_${new Date().toISOString().slice(0, 10)}.xlsx`;
            await downloadXlsxBlob(data as any, filename);
            show('Berhasil', 'Template Excel berhasil diunduh.', 'success');
        } catch (e) {
            show('Gagal', getErrorMessage(e, 'Gagal unduh template'), 'error');
        } finally {
            setBusy(null);
        }
    };

    const handlePick = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                    'application/octet-stream',
                    '*/*',
                ],
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];
            setPickedName(asset.name || 'import.xlsx');
            setPreview(null);
            setCommitResult(null);
            if (Platform.OS === 'web') {
                const resp = await fetch(asset.uri);
                const blob = await resp.blob();
                const file = new File([blob], asset.name || 'import.xlsx', {
                    type: asset.mimeType || blob.type,
                });
                setPicked(file);
            } else {
                setPicked({
                    uri: asset.uri,
                    name: asset.name || 'import.xlsx',
                    type:
                        asset.mimeType ||
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                });
            }
        } catch (e) {
            show('Gagal', getErrorMessage(e, 'Gagal memilih file'), 'error');
        }
    };

    const handlePreview = async () => {
        if (!picked) {
            show('File', 'Pilih file Excel dulu.', 'warning');
            return;
        }
        try {
            setBusy('preview');
            setCommitResult(null);
            const res = await dataImportService.preview(picked);
            setPreview(res);
            if (res.ok) {
                show(
                    'Preview OK',
                    'Tidak ada error validasi. Anda bisa Commit import.',
                    'success'
                );
            } else {
                show(
                    'Ada error',
                    'Perbaiki baris bermasalah di Excel, lalu Preview ulang.',
                    'warning'
                );
            }
        } catch (e: any) {
            const detail = e?.response?.data?.detail;
            if (detail?.sheets) {
                setPreview({
                    batch_id: detail.batch_id || '-',
                    dry_run: true,
                    ok: false,
                    sheets: detail.sheets,
                });
            }
            show('Gagal preview', getErrorMessage(e, 'Preview gagal'), 'error');
        } finally {
            setBusy(null);
        }
    };

    const handleCommit = async () => {
        if (!picked) {
            show('File', 'Pilih file Excel dulu.', 'warning');
            return;
        }
        if (preview && !preview.ok) {
            show('Validasi', 'Masih ada error. Preview harus lolos dulu.', 'warning');
            return;
        }
        try {
            setBusy('commit');
            const res = await dataImportService.commit(picked);
            setCommitResult(res);
            setPreview(res);
            show(
                'Import sukses',
                `Batch ${res.batch_id} tersimpan. Cek stok, dompet, hutang/piutang.`,
                'success'
            );
        } catch (e: any) {
            const detail = e?.response?.data?.detail;
            if (detail?.sheets) {
                setPreview({
                    batch_id: detail.batch_id || '-',
                    dry_run: false,
                    ok: false,
                    sheets: detail.sheets,
                });
            }
            show('Gagal commit', getErrorMessage(e, 'Import gagal'), 'error');
        } finally {
            setBusy(null);
        }
    };

    return (
        <View className="flex-1 bg-gray-50">
            <StatusBar barStyle="dark-content" />
            <Header title="Import Data" showBackButton />
            <ScrollView
                contentContainerStyle={{
                    padding: 16,
                    paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 32),
                }}
            >
                <Card className="p-5 mb-4 border border-amber-100 bg-amber-50/80">
                    <View className="flex-row items-start">
                        <Info size={18} color="#B45309" />
                        <View className="flex-1 ml-3">
                            <Typography weight="bold" className="text-amber-900 text-sm">
                                Import master + opening balance
                            </Typography>
                            <Typography className="text-amber-800/80 text-xs mt-1 leading-5">
                                Bukan full histori transaksi. Isi template multi-sheet, Preview
                                dulu, lalu Commit. Backup DB sebelum production. Idempotent per
                                batch untuk kas/hutang/piutang opening.
                            </Typography>
                        </View>
                    </View>
                </Card>

                <Card className="p-5 mb-4">
                    <Typography weight="bold" className="text-base mb-3">
                        1. Download template
                    </Typography>
                    <Button
                        title={busy === 'template' ? 'Mengunduh…' : 'Download TPM_IMPORT_TEMPLATE.xlsx'}
                        onPress={handleDownloadTemplate}
                        disabled={!!busy}
                        loading={busy === 'template'}
                    />
                </Card>

                <Card className="p-5 mb-4">
                    <Typography weight="bold" className="text-base mb-3">
                        2. Pilih file Excel
                    </Typography>
                    <Pressable
                        onPress={handlePick}
                        className="border border-dashed border-gray-300 rounded-2xl p-6 items-center bg-white active:bg-gray-50"
                    >
                        <FileSpreadsheet size={28} color={themeColors.primary} />
                        <Typography weight="bold" className="mt-2 text-sm">
                            {pickedName || 'Ketuk untuk pilih .xlsx'}
                        </Typography>
                        <Typography className="text-xs text-gray-400 mt-1">
                            Maks 8MB · multi-sheet
                        </Typography>
                    </Pressable>
                </Card>

                <Card className="p-5 mb-4">
                    <Typography weight="bold" className="text-base mb-3">
                        3. Preview & Commit
                    </Typography>
                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <Button
                                title="Preview"
                                variant="outline"
                                onPress={handlePreview}
                                disabled={!!busy || !picked}
                                loading={busy === 'preview'}
                            />
                        </View>
                        <View className="flex-1">
                            <Button
                                title="Commit"
                                onPress={handleCommit}
                                disabled={!!busy || !picked || (preview ? !preview.ok : false)}
                                loading={busy === 'commit'}
                            />
                        </View>
                    </View>
                    {preview ? (
                        <View className="mt-4">
                            <View className="flex-row items-center mb-2">
                                {preview.ok ? (
                                    <CheckCircle2 size={16} color="#059669" />
                                ) : (
                                    <AlertTriangle size={16} color="#DC2626" />
                                )}
                                <Typography className="ml-2 text-xs text-gray-600">
                                    Batch {preview.batch_id} ·{' '}
                                    {preview.dry_run ? 'dry-run' : 'committed'} · error{' '}
                                    {totalErrors}
                                </Typography>
                            </View>
                            {Object.entries(preview.sheets || {}).map(([name, s]) => (
                                <View
                                    key={name}
                                    className="bg-gray-50 rounded-2xl p-3 mb-2 border border-gray-100"
                                >
                                    <View className="flex-row items-center justify-between">
                                        <Typography weight="bold" className="text-sm">
                                            {name}
                                        </Typography>
                                        <Badge
                                            label={
                                                s.errors?.length
                                                    ? `${s.errors.length} err`
                                                    : 'OK'
                                            }
                                            variant={s.errors?.length ? 'error' : 'success'}
                                        />
                                    </View>
                                    <Typography className="text-[11px] text-gray-500 mt-1">
                                        rows {s.rows} · +{s.created} · ~{s.updated} · skip{' '}
                                        {s.skipped}
                                    </Typography>
                                    {(s.errors || []).slice(0, 5).map((e, i) => (
                                        <Typography
                                            key={i}
                                            className="text-[11px] text-rose-600 mt-0.5"
                                        >
                                            • {e}
                                        </Typography>
                                    ))}
                                    {(s.errors?.length || 0) > 5 ? (
                                        <Typography className="text-[11px] text-gray-400 mt-1">
                                            +{(s.errors?.length || 0) - 5} error lain…
                                        </Typography>
                                    ) : null}
                                </View>
                            ))}
                        </View>
                    ) : null}
                    {commitResult?.ok ? (
                        <View className="mt-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <Typography className="text-emerald-800 text-xs font-bold">
                                Import selesai. Cek menu master, inventori, dompet, hutang &
                                piutang.
                            </Typography>
                        </View>
                    ) : null}
                </Card>
            </ScrollView>

            <AlertDialog
                visible={dialog.visible}
                title={dialog.title}
                message={dialog.message}
                variant={dialog.variant}
                onClose={() => setDialog((d) => ({ ...d, visible: false }))}
            />
        </View>
    );
}


