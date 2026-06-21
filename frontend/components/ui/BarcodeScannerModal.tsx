import React, { useState, useEffect, useRef, useMemo, useCallback, FC } from 'react';
import { View, StyleSheet, Pressable, SafeAreaView, StatusBar, Platform, TextInput, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Typography } from './Typography';
import { X, Zap, ZapOff, Scan, Camera, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { Button } from './Button';
import { useScanSound, ensureAudioUnlocked } from '../../utils/sounds';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

type ScanMatch = 'none' | 'match' | 'no-match';

interface BarcodeScannerModalProps {
    visible: boolean;
    onClose: () => void;
    onScan: (data: string) => boolean | Promise<boolean>;
    scanLog?: { id: string; title: string; subtitle?: string; timestamp: number }[];
    continuous?: boolean;
}

export const BarcodeScannerModal: FC<BarcodeScannerModalProps> = ({
    visible,
    onClose,
    onScan,
    scanLog = [],
    continuous = false
}) => {
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [torch, setTorch] = useState(false);
    const [laserPos, setLaserPos] = useState(0);
    const [movingDown, setMovingDown] = useState(true);
    const [scannerMode, setScannerMode] = useState<'camera' | 'hardware' | 'web-camera'>(
        Platform.OS === 'web' ? 'web-camera' : 'camera'
    );
    const [hwInput, setHwInput] = useState('');
    const hwInputRef = useRef<TextInput>(null);

    // html5-qrcode refs (web camera scanner)
    const html5QrcodeRef = useRef<Html5QrcodeType>(null);
    const webScannerContainerRef = useRef<HTMLDivElement | null>(null);
    const webScanInProgress = useRef(false);
    const scannerPausedRef = useRef(false);

    // Stable ref for onScan to prevent effect restart loop
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;

    // Scan sound hook — wrap in refs to keep stable references
    const { playSuccess, playError } = useScanSound();
    const playSuccessRef = useRef(playSuccess);
    const playErrorRef = useRef(playError);
    playSuccessRef.current = playSuccess;
    playErrorRef.current = playError;

    // Web camera error + flash indicator state
    const [webCameraError, setWebCameraError] = useState<string | null>(null);
    const [webFlashVisible, setWebFlashVisible] = useState(false);
    const flashAnim = useRef(new Animated.Value(0)).current;

    // Scan match indicator state
    const [scanMatch, setScanMatch] = useState<ScanMatch>('none');
    const scanMatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerWebFlash = useCallback(() => {
        setWebFlashVisible(true);
        flashAnim.setValue(0);
        Animated.timing(flashAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setWebFlashVisible(false);
        });
    }, [flashAnim]);

    const showScanMatch = useCallback((match: ScanMatch) => {
        if (scanMatchTimer.current) clearTimeout(scanMatchTimer.current);
        setScanMatch(match);
        scanMatchTimer.current = setTimeout(() => {
            setScanMatch('none');
        }, 1500);
    }, []);

    // Laser Animation Effect
    useEffect(() => {
        if (!visible) return;
        const interval = setInterval(() => {
            setLaserPos((prev: number) => {
                if (movingDown) {
                    if (prev >= 240) { setMovingDown(false); return 240; }
                    return prev + 5;
                } else {
                    if (prev <= 10) { setMovingDown(true); return 10; }
                    return prev - 5;
                }
            });
        }, 30);
        return () => clearInterval(interval);
    }, [visible, movingDown]);

    useEffect(() => {
        let mounted = true;

        const initializeScanner = async () => {
            if (!mounted) return;

            if (visible && !permission?.granted && scannerMode === 'camera') {
                requestPermission();
            }

            // Load preferred mode
            const saved = await AsyncStorage.getItem('@scanner_mode');
            if (mounted && saved) {
                const mode = saved as any;
                // Web: camera mode (expo-camera) relies on browser BarcodeDetector
                // which doesn't reliably support Code-128 on mobile browsers.
                // Auto-upgrade to web-camera (html5-qrcode) with explicit format support.
                if (Platform.OS === 'web' && mode === 'camera') {
                    setScannerMode('web-camera');
                } else {
                    setScannerMode(mode);
                }
            }
        };

        initializeScanner();

        // Auto-focus hardware input if visible
        if (visible) {
            const timeoutId = setTimeout(() => hwInputRef.current?.focus(), 500);
            return () => clearTimeout(timeoutId);
        }

        // Browser compatibility check for 1D barcodes
        if (visible && Platform.OS === 'web' && (window as any).BarcodeDetector) {
            (window as any).BarcodeDetector.getSupportedFormats().then((formats: string[]) => {
                console.log(`[Scanner] Browser natively supports: ${formats.join(', ')}`);
            }).catch(console.error);
        }

        return () => {
            mounted = false;
        };
    }, [visible, permission, scannerMode]);

    // html5-qrcode lifecycle (web-camera mode) — Code 128 fix
    useEffect(() => {
        if (Platform.OS !== 'web' || scannerMode !== 'web-camera' || !visible) return;

        let isCancelled = false;

        const startWebScanner = async () => {
            console.log('[DEBUG] startWebScanner ENTERED');
            if (isCancelled) { console.log('[DEBUG] startWebScanner CANCELLED before start'); return; }

            const scannerId = 'web-scanner-reader';
            const container = document.getElementById(scannerId);
            console.log('[DEBUG] container element:', container);
            if (!container) {
                console.log('[DEBUG] container not found — retry in 200ms');
                setTimeout(() => { if (!isCancelled) startWebScanner(); }, 200);
                return;
            }
            container.innerHTML = '';

            console.log('[DEBUG] Html5Qrcode class:', typeof Html5Qrcode);
            const html5Qrcode = new Html5Qrcode(scannerId);

            try {
                await html5Qrcode.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        formatsToSupport: [
                            Html5QrcodeSupportedFormats.QR_CODE,
                            Html5QrcodeSupportedFormats.CODE_128,
                            Html5QrcodeSupportedFormats.CODE_39,
                            Html5QrcodeSupportedFormats.EAN_13,
                            Html5QrcodeSupportedFormats.EAN_8,
                            Html5QrcodeSupportedFormats.UPC_A,
                            Html5QrcodeSupportedFormats.UPC_E,
                            Html5QrcodeSupportedFormats.DATA_MATRIX,
                            Html5QrcodeSupportedFormats.PDF_417,
                        ],
                    },
                    async (decodedText: string) => {
                        if (webScanInProgress.current) return;
                        webScanInProgress.current = true;
                        try {
                            const matched = await onScan(decodedText);
                            if (matched) {
                                playSuccess();
                                showScanMatch('match');
                            } else {
                                playError();
                                showScanMatch('no-match');
                            }
                        } catch {
                            playError();
                            showScanMatch('no-match');
                        }
                        // Short cooldown before allowing next scan
                        setTimeout(() => {
                            webScanInProgress.current = false;
                        }, 1500);
                    },
                    () => {
                        // Scan failure callback — ignore (fires on every frame with no barcode)
                    }
                );

                // Only store ref AFTER start succeeds — prevents stop() on non-running scanner
                if (!isCancelled) {
                    html5QrcodeRef.current = html5Qrcode;
                } else {
                    // Unmounted during start — clean up orphan scanner
                    const container = document.getElementById('web-scanner-reader');
                    const video = container?.querySelector('video');
                    if (video) {
                        video.onabort = null;
                        video.onerror = null;
                        if (video.srcObject) {
                            try {
                                const stream = video.srcObject as MediaStream;
                                stream.getTracks().forEach(track => track.stop());
                                video.srcObject = null;
                            } catch (e) {}
                        }
                    }
                    html5Qrcode.stop().catch(() => {});
                }
            } catch (err) {
                console.error('[WebScanner] Failed to start html5-qrcode:', err);
                setWebCameraError(err instanceof Error ? err.message : 'Gagal mengakses kamera. Periksa izin browser atau coba browser lain.');
            }
        };

        startWebScanner();

        return () => {
            isCancelled = true;

            // Find active video element in DOM and stop its media tracks aggressively to prevent WebMediaPlayer leaks
            const container = document.getElementById('web-scanner-reader');
            const video = container?.querySelector('video');
            if (video) {
                video.onabort = null;
                video.onerror = null;
                if (video.srcObject) {
                    try {
                        const stream = video.srcObject as MediaStream;
                        stream.getTracks().forEach(track => track.stop());
                        video.srcObject = null;
                    } catch (e) {
                        console.error('[WebScanner] Error stopping tracks manually:', e);
                    }
                }
            }

            if (html5QrcodeRef.current) {
                const scanner = html5QrcodeRef.current;
                html5QrcodeRef.current = null;
                scanner.stop().catch(() => {});
            }
        };
    // NOTE: onScan, playSuccess, playError accessed via refs to prevent restart loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, scannerMode, showScanMatch]);

    const toggleScannerMode = async () => {
        let newMode: 'camera' | 'hardware' | 'web-camera';
        if (Platform.OS === 'web') {
            // Web: cycle 'hardware' ↔ 'web-camera'
            newMode = scannerMode === 'hardware' ? 'web-camera' : 'hardware';
        } else {
            // Native: cycle 'camera' ↔ 'hardware'
            newMode = scannerMode === 'camera' ? 'hardware' : 'camera';
        }
        setScannerMode(newMode);
        await AsyncStorage.setItem('@scanner_mode', newMode);
        if (newMode === 'hardware') {
            setTimeout(() => hwInputRef.current?.focus(), 200);
        }
    };

    const handleBarCodeScanned = async (result: { type: string, data: string }) => {
        if (scanned) return;
        setScanned(true);
        try {
            const matched = await onScan(result.data);
            if (matched) {
                playSuccess();
                showScanMatch('match');
            } else {
                playError();
                showScanMatch('no-match');
            }
        } catch {
            playError();
            showScanMatch('no-match');
        }
        // In continuous mode, use shorter cooldown (1s) so user can scan rapidly
        // In single-scan mode, use 2s cooldown
        const cooldown = continuous ? 1000 : 2000;
        setTimeout(() => {
            setScanned(false);
        }, cooldown);
    };

    // Stable settings object to prevent unnecessary re-renders/scanner resets
    const scannerSettings = useMemo(() => ({
        barcodeTypes: [
            "qr",
            "ean13",
            "ean8",
            "code128",
            "code39",
            "upc_a",
            "upc_e",
            "datamatrix",
            "pdf417"
        ] as any[],
    }), []);

    if (!visible) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 10000, backgroundColor: 'black' }]}>
            <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <StatusBar barStyle="light-content" />

                {!permission?.granted && scannerMode !== 'web-camera' ? (
                    <View style={styles.permissionContainer}>
                        <Typography variant="h3" weight="bold" className="text-center mb-4">Izin Kamera Diperlukan</Typography>
                        <Typography className="text-gray-500 text-center mb-8 px-10">
                            Kami memerlukan akses kamera untuk memindai barcode sparepart secara instan.
                        </Typography>
                        <Button title="Berikan Izin" onPress={requestPermission} />
                        <Pressable onPress={onClose} className="mt-4">
                            <Typography className="text-gray-400">Batal</Typography>
                        </Pressable>
                    </View>
                ) : (
                    <View style={styles.cameraContainer}>
                        {webCameraError ? (
                            <View className="flex-1 items-center justify-center bg-gray-900 px-10">
                                <View className="w-20 h-20 bg-red-500/10 rounded-full items-center justify-center mb-6 border border-red-500/20">
                                    <AlertTriangle size={40} color="#EF4444" strokeWidth={1} />
                                </View>
                                <Typography variant="h3" weight="bold" className="text-white text-center mb-3">Kamera Tidak Tersedia</Typography>
                                <Typography className="text-gray-400 text-center mb-8">{webCameraError}</Typography>
                                <View className="flex-row space-x-3">
                                    <Button title="Coba Lagi" variant="primary" onPress={() => { setWebCameraError(null); }} />
                                    <Button title="Tutup" variant="secondary" onPress={onClose} />
                                </View>
                            </View>
                        ) : scannerMode === 'web-camera' ? (
                            <View className="flex-1 items-center justify-center bg-gray-900 px-4">
                                {/* Web Camera Scanner via html5-qrcode */}
                                <View className="w-full max-w-md">
                                    <View className="items-center mb-4">
                                        <View className="w-16 h-16 bg-blue-500/10 rounded-full items-center justify-center mb-4 border border-blue-500/20">
                                            <Camera size={32} color="#3B82F6" strokeWidth={1} />
                                        </View>
                                        <Typography variant="h3" weight="bold" className="text-white text-center mb-2">Web Camera</Typography>
                                        <Typography className="text-gray-400 text-center text-sm">
                                            Arahkan kamera ke barcode/QR code untuk memindai.
                                        </Typography>
                                    </View>
                                    <div
                                        id="web-scanner-reader"
                                        ref={webScannerContainerRef as React.RefObject<HTMLDivElement>}
                                        style={{
                                            width: '100%',
                                            height: 350,
                                            borderRadius: 16,
                                            overflow: 'hidden',
                                            backgroundColor: '#000',
                                            borderWidth: 2,
                                            borderStyle: 'solid',
                                            borderColor: scanMatch === 'no-match' ? '#EF4444' : scanMatch === 'match' ? '#10B981' : 'rgba(59,130,246,0.3)',
                                        }}
                                    >
                                        {/* Style video injected by html5-qrcode to fill container */}
                                        <style>{`#web-scanner-reader video { width: 100% !important; height: 100% !important; object-fit: cover !important; }`}</style>
                                    </div>
                                    {/* A11y: screen reader announces scan results */}
                                    <View
                                        aria-live="assertive"
                                        aria-atomic="true"
                                        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
                                    >
                                        <Typography>{scanMatch === 'match' ? 'Item ditemukan' : scanMatch === 'no-match' ? 'Item tidak ditemukan' : ''}</Typography>
                                    </View>
                                </View>
                            </View>
                        ) : scannerMode === 'camera' ? (
                            <CameraView
                                style={styles.camera}
                                enableTorch={torch}
                                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                                barcodeScannerSettings={scannerSettings}
                            >
                                {/* Overlay */}
                                <View style={styles.overlay}>
                                    <View style={styles.unfocusedContainer}>
                                        {/* Item Scan Mode Badge */}
                                        {continuous && (
                                            <View style={{ position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.85)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}>
                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6EE7B7', marginRight: 8 }} />
                                                <Typography weight="bold" style={{ color: 'white', fontSize: 11 }}>ITEM SCAN</Typography>
                                                {scanLog.length > 0 && (
                                                    <View style={{ backgroundColor: 'white', borderRadius: 10, marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                                                        <Typography weight="bold" style={{ color: '#059669', fontSize: 11 }}>{scanLog.length}</Typography>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.middleContainer}>
                                        <View style={styles.unfocusedContainer}></View>
                                        <View style={styles.focusedContainer}>
                                            <View style={[styles.corner, styles.topLeft]} />
                                            <View style={[styles.corner, styles.topRight]} />
                                            <View style={[styles.corner, styles.bottomLeft]} />
                                            <View style={[styles.corner, styles.bottomRight]} />

                                            {/* Laser Line */}
                                            <View style={[styles.laser, { top: laserPos }]} />

                                            {/* Scan match indicator: green for match, red for no-match */}
                                            {scanMatch === 'match' && (
                                                <View style={styles.scannedMatchIndicator}>
                                                    <CheckCircle2 size={28} color="white" strokeWidth={2} />
                                                    <Typography weight="bold" style={{ color: 'white', marginTop: 4 }}>
                                                        {continuous ? 'Item Ditemukan!' : 'Terdeteksi!'}
                                                    </Typography>
                                                </View>
                                            )}
                                            {scanMatch === 'no-match' && (
                                                <View style={styles.scannedNoMatchIndicator}>
                                                    <View style={styles.noMatchIconContainer}>
                                                        <Typography weight="bold" style={{ color: 'white', fontSize: 20 }}>✕</Typography>
                                                    </View>
                                                    <Typography weight="bold" style={{ color: 'white', marginTop: 4 }}>Item Tidak Ditemukan</Typography>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.unfocusedContainer}></View>
                                    </View>
                                    <View style={styles.unfocusedContainer}>
                                        <View className="items-center mt-6">
                                            <Typography className="text-white text-center mb-6" style={{ opacity: 0.7 }}>
                                                {continuous
                                                    ? 'Scan terus-menerus — arahkan ke barcode berikutnya'
                                                    : 'Posisikan barcode/QR code di dalam kotak'
                                                }
                                            </Typography>

                                            {/* Scanner Log Overlay */}
                                            {scanLog.length > 0 && (
                                                <View className="w-[90%] bg-black/40 rounded-3xl p-4 border border-white/10 mt-2">
                                                    <Typography variant="caption" weight="bold" className="text-white/60 mb-3 ml-1 uppercase" style={{ letterSpacing: 1 }}>History Scan Terakhir</Typography>
                                                    {scanLog.slice(0, 3).map((item, idx) => (
                                                        <View key={item.id} className={`flex-row items-center py-2.5 px-3 mb-2 rounded-2xl ${idx === 0 ? 'bg-blue-600/30 border border-blue-500/30' : 'bg-white/5 border border-white/5'}`}>
                                                            <View className={`w-2 h-2 rounded-full mr-3 ${idx === 0 ? 'bg-blue-400' : 'bg-white/20'}`} />
                                                            <View className="flex-1">
                                                                <Typography weight="bold" className="text-white text-sm" numberOfLines={1}>{item.title}</Typography>
                                                                {item.subtitle && <Typography variant="caption" className="text-white/50 text-[10px]">{item.subtitle}</Typography>}
                                                            </View>
                                                            <Typography variant="caption" className="text-white/40 ml-2">Baru saja</Typography>
                                                        </View>
                                                    ))}
                                                    <Typography variant="caption" weight="bold" className="text-blue-400 text-center mt-2 mb-4">Total: {scanLog.length} item tersimpan</Typography>

                                                    <Button
                                                        title="Selesai & Tutup"
                                                        variant="primary"
                                                        onPress={onClose}
                                                        className="h-12 rounded-2xl"
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>
                                {/* A11y: screen reader announces scan results for native camera */}
                                <View
                                    aria-live="assertive"
                                    aria-atomic="true"
                                    style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
                                >
                                    <Typography>{scanMatch === 'match' ? 'Item ditemukan' : scanMatch === 'no-match' ? 'Item tidak ditemukan' : ''}</Typography>
                                </View>
                            </CameraView>
                        ) : (
                            <View className="flex-1 items-center justify-center bg-gray-900 px-10">
                                {/* Item Scan Mode Badge for Hardware */}
                                {continuous && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.85)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 24 }}>
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6EE7B7', marginRight: 8 }} />
                                        <Typography weight="bold" style={{ color: 'white', fontSize: 11 }}>ITEM SCAN</Typography>
                                        {scanLog.length > 0 && (
                                            <View style={{ backgroundColor: 'white', borderRadius: 10, marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                                                <Typography weight="bold" style={{ color: '#059669', fontSize: 11 }}>{scanLog.length}</Typography>
                                            </View>
                                        )}
                                    </View>
                                )}
                                <View className="w-40 h-40 bg-blue-500/10 rounded-full items-center justify-center mb-8 border border-blue-500/20">
                                    <Scan size={64} color="#3B82F6" strokeWidth={1} />
                                </View>
                                <Typography variant="h3" weight="bold" className="text-white text-center mb-2">Hardware Mode</Typography>
                                <Typography className="text-gray-400 text-center mb-10">
                                    {continuous
                                        ? 'Scan terus-menerus — arahkan ke barcode berikutnya'
                                        : 'Arahkan hardware scanner ke barcode dan tekan pelatuk scan.'
                                    }
                                </Typography>

                                <Pressable
                                    onPress={() => hwInputRef.current?.focus()}
                                    className="bg-white/5 border border-white/10 px-6 py-4 rounded-3xl items-center w-full"
                                >
                                    <Typography className="text-blue-400 font-bold">Siap Menerima Scan...</Typography>
                                </Pressable>

                                {scanLog.length > 0 && (
                                    <View className="mt-8 w-full">
                                        <Typography variant="caption" weight="bold" className="text-white/40 text-center uppercase mb-4 tracking-widest">Item Terakhir</Typography>
                                        <View className="bg-white/5 border border-white/10 p-4 rounded-3xl mb-4">
                                            <Typography weight="bold" className="text-white text-center">{scanLog[0].title}</Typography>
                                            <Typography variant="caption" className="text-white/50 text-center">{scanLog[0].subtitle}</Typography>
                                        </View>
                                        {continuous && (
                                            <View>
                                                <Typography variant="caption" weight="bold" className="text-emerald-400 text-center mb-4">Total: {scanLog.length} item tersimpan</Typography>
                                                <Button
                                                    title="Selesai & Tutup"
                                                    variant="primary"
                                                    onPress={onClose}
                                                    className="h-12 rounded-2xl"
                                                />
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Hidden Input for Hardware Scanner */}
                        <TextInput
                            ref={hwInputRef}
                            style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
                            value={hwInput}
                            onChangeText={setHwInput}
                            onSubmitEditing={(e) => {
                                const code = e.nativeEvent.text;
                                if (code) {
                                    handleBarCodeScanned({ type: 'hardware', data: code });
                                    setHwInput('');
                                    // Keep focused for next scan
                                    setTimeout(() => hwInputRef.current?.focus(), 100);
                                }
                            }}
                            autoFocus={visible}
                            blurOnSubmit={false}
                        />

                        {/* Controls */}
                        <View style={styles.header}>
                            <Pressable
                                onPress={toggleScannerMode}
                                style={[styles.iconButton, { width: 'auto', paddingHorizontal: 16 }]}
                            >
                                {scannerMode === 'camera' || scannerMode === 'web-camera' ? (
                                    <View className="flex-row items-center">
                                        <Scan size={18} color="white" />
                                        <Typography className="text-white text-[10px] ml-2 font-bold uppercase">To Hardware</Typography>
                                    </View>
                                ) : (
                                    <View className="flex-row items-center">
                                        <Camera size={18} color="white" />
                                        <Typography className="text-white text-[10px] ml-2 font-bold uppercase">To Camera</Typography>
                                    </View>
                                )}
                            </Pressable>
                            <View className="flex-row space-x-2">
                                {scannerMode === 'camera' && (
                                    <Pressable onPress={() => setTorch(!torch)} style={styles.iconButton}>
                                        {torch ? <Zap size={24} color="#FBBF24" /> : <ZapOff size={24} color="white" />}
                                    </Pressable>
                                )}
                                <Pressable onPress={onClose} style={styles.iconButton}>
                                    <X size={24} color="white" />
                                </Pressable>
                            </View>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: 'white',
    },
    cameraContainer: {
        flex: 1,
        position: 'relative',
    },
    camera: {
        flex: 1,
    },
    header: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 20 : 40,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        zIndex: 10,
    },
    iconButton: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlay: {
        flex: 1,
    },
    unfocusedContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    middleContainer: {
        flexDirection: 'row',
        height: 250,
    },
    focusedContainer: {
        width: 250,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: '#3B82F6',
        borderWidth: 4,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderTopLeftRadius: 16,
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
        borderTopRightRadius: 16,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
        borderBottomLeftRadius: 16,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderBottomRightRadius: 16,
    },
    scannedMatchIndicator: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(16, 185, 129, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    scannedNoMatchIndicator: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(239, 68, 68, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    noMatchIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    laser: {
        position: 'absolute',
        left: 10,
        right: 10,
        height: 2,
        backgroundColor: '#3B82F6',
        shadowColor: "#3B82F6",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 10,
    }
});
