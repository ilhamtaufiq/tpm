import React, { useState, useEffect, useRef, useMemo, FC } from 'react';
import { View, StyleSheet, Pressable, SafeAreaView, StatusBar, Platform, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Typography } from './Typography';
import { X, Zap, ZapOff, Scan, Camera, Loader } from 'lucide-react-native';
import { Button } from './Button';
import { useScanSound } from '../../utils/sounds';

// Dynamic import type for html5-qrcode (web only)
type Html5QrcodeType = any;

interface BarcodeScannerModalProps {
    visible: boolean;
    onClose: () => void;
    onScan: (data: string) => void;
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
    const [scannerMode, setScannerMode] = useState<'camera' | 'hardware' | 'web-camera'>('camera');
    const [hwInput, setHwInput] = useState('');
    const hwInputRef = useRef<TextInput>(null);

    // html5-qrcode refs (web camera scanner)
    const html5QrcodeRef = useRef<Html5QrcodeType>(null);
    const webScannerContainerRef = useRef<View | null>(null);
    const webScanInProgress = useRef(false);

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
            if (mounted && saved) setScannerMode(saved as any);
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

    // html5-qrcode lifecycle (web-camera mode)
    useEffect(() => {
        if (Platform.OS !== 'web' || scannerMode !== 'web-camera' || !visible) return;

        let isCancelled = false;

        const startWebScanner = async () => {
            try {
                // Dynamic import — only loaded on web, no native bundle impact
                // @ts-expect-error -- dynamic import fine for web build
                const { Html5Qrcode, Html5QrcodeSupportedFormats: Fmts } = await import('html5-qrcode');

                // Fallback: enum may be undefined in some bundlers — use hardcoded numeric values
                const QR_CODE = Fmts?.QR_CODE ?? 0;
                const CODE_128 = Fmts?.CODE_128 ?? 8;
                const CODE_39 = Fmts?.CODE_39 ?? 12;
                const EAN_13 = Fmts?.EAN_13 ?? 4;
                const EAN_8 = Fmts?.EAN_8 ?? 5;
                const UPC_A = Fmts?.UPC_A ?? 1;
                const UPC_E = Fmts?.UPC_E ?? 2;
                const DATA_MATRIX = Fmts?.DATA_MATRIX ?? 6;
                const PDF_417 = Fmts?.PDF_417 ?? 11;

                if (isCancelled) return;

                const scannerId = 'web-scanner-reader';

                // Ensure the DOM element exists before init
                const container = document.getElementById(scannerId);
                if (!container) {
                    // Not mounted yet — retry briefly
                    setTimeout(() => { if (!isCancelled) startWebScanner(); }, 200);
                    return;
                }

                const html5Qrcode = new Html5Qrcode(scannerId);
                html5QrcodeRef.current = html5Qrcode;

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
                    (decodedText: string) => {
                        if (webScanInProgress.current) return;
                        webScanInProgress.current = true;
                        onScan(decodedText);
                        // Short cooldown before allowing next scan
                        setTimeout(() => {
                            webScanInProgress.current = false;
                        }, 1500);
                    },
                    () => {
                        // Scan failure callback — ignore (fires on every frame with no barcode)
                    }
                );
            } catch (err) {
                console.error('[WebScanner] Failed to start html5-qrcode:', err);
            }
        };

        startWebScanner();

        return () => {
            isCancelled = true;
            if (html5QrcodeRef.current) {
                html5QrcodeRef.current
                    .stop()
                    .then(() => {
                        html5QrcodeRef.current?.clear();
                        html5QrcodeRef.current = null;
                    })
                    .catch(() => {
                        html5QrcodeRef.current = null;
                    });
            }
        };
    }, [visible, scannerMode, onScan]);

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

    const handleBarCodeScanned = (result: { type: string, data: string }) => {
        if (scanned) return;
        // console.log(`[Scanner] Scanned type: ${result.type}, data: ${result.data}`);
        setScanned(true);
        onScan(result.data);
        // In continuous mode, use shorter cooldown (1s) so user can scan rapidly
        // In single-scan mode, use 2s cooldown
        const cooldown = continuous ? 1000 : 2000;
        setTimeout(() => setScanned(false), cooldown);
    };

    // Stable settings object to prevent unnecessary re-renders/scanner resets
    // Some browsers on Web require explicit types to activate the 1D detection engine
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
                        {scannerMode === 'web-camera' ? (
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
                                    <View
                                        // @ts-ignore — id is valid on web for html5-qrcode to attach
                                        id="web-scanner-reader"
                                        ref={webScannerContainerRef}
                                        style={{
                                            width: '100%',
                                            height: 350,
                                            borderRadius: 16,
                                            overflow: 'hidden',
                                            backgroundColor: '#000',
                                            borderWidth: 2,
                                            borderColor: 'rgba(59,130,246,0.3)',
                                            borderStyle: 'solid',
                                        }}
                                    />
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
                                        {/* Continuous Mode Badge */}
                                        {continuous && (
                                            <View style={{ position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.85)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}>
                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6EE7B7', marginRight: 8 }} />
                                                <Typography weight="bold" style={{ color: 'white', fontSize: 11 }}>CONTINUOUS SCAN</Typography>
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

                                            {scanned && (
                                                <View style={styles.scannedIndicator}>
                                                    <Typography weight="bold" style={{ color: 'white' }}>{continuous ? '✓ Ditambahkan!' : 'Terdeteksi!'}</Typography>
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
                            </CameraView>
                        ) : (
                            <View className="flex-1 items-center justify-center bg-gray-900 px-10">
                                {/* Continuous Mode Badge for Hardware */}
                                {continuous && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.85)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 24 }}>
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6EE7B7', marginRight: 8 }} />
                                        <Typography weight="bold" style={{ color: 'white', fontSize: 11 }}>CONTINUOUS SCAN</Typography>
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
                                {scannerMode === 'camera' ? (
                                    <View className="flex-row items-center">
                                        <Scan size={18} color="white" />
                                        <Typography className="text-white text-[10px] ml-2 font-bold uppercase">To Hardware</Typography>
                                    </View>
                                ) : scannerMode === 'web-camera' ? (
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
    scannedIndicator: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
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
