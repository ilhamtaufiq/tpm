import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Modal, SafeAreaView, StatusBar, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Typography } from './Typography';
import { X, Zap, ZapOff } from 'lucide-react-native';
import { Button } from './Button';

interface BarcodeScannerModalProps {
    visible: boolean;
    onClose: () => void;
    onScan: (data: string) => void;
    scanLog?: { id: string; title: string; subtitle?: string; timestamp: number }[];
    continuous?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ 
    visible, 
    onClose, 
    onScan, 
    scanLog = [],
    continuous = false
}) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [torch, setTorch] = useState(false);
    const [laserPos, setLaserPos] = useState(0);
    const [movingDown, setMovingDown] = useState(true);

    // Laser Animation Effect
    useEffect(() => {
        if (!visible) return;
        const interval = setInterval(() => {
            setLaserPos(prev => {
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
        if (visible && !permission?.granted) {
            requestPermission();
        }
        
        // Browser compatibility check for 1D barcodes
        if (visible && Platform.OS === 'web' && (window as any).BarcodeDetector) {
            (window as any).BarcodeDetector.getSupportedFormats().then((formats: string[]) => {
                console.log(`[Scanner] Browser natively supports: ${formats.join(', ')}`);
            }).catch(console.error);
        }
    }, [visible, permission]);

    const handleBarCodeScanned = (result: { type: string, data: string }) => {
        if (scanned) return;
        // console.log(`[Scanner] Scanned type: ${result.type}, data: ${result.data}`);
        setScanned(true);
        onScan(result.data);
        // Reset scanned state after a delay to allow another scan if needed
        setTimeout(() => setScanned(false), 2000);
    };

    // Stable settings object to prevent unnecessary re-renders/scanner resets
    // Some browsers on Web require explicit types to activate the 1D detection engine
    const scannerSettings = React.useMemo(() => ({
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
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" />
                
                {!permission?.granted ? (
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
                        <CameraView
                            style={styles.camera}
                            enableTorch={torch}
                            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                            barcodeScannerSettings={scannerSettings}
                        >
                            {/* Overlay */}
                            <View style={styles.overlay}>
                                <View style={styles.unfocusedContainer}></View>
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
                                                <Typography weight="bold" style={{ color: 'white' }}>Terdeteksi!</Typography>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.unfocusedContainer}></View>
                                </View>
                                <View style={styles.unfocusedContainer}>
                                    <View className="items-center mt-6">
                                        <Typography className="text-white text-center mb-6" style={{ opacity: 0.7 }}>
                                            Posisikan barcode/QR code di dalam kotak
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

                        {/* Controls */}
                        <View style={styles.header}>
                            <Pressable onPress={onClose} style={styles.iconButton}>
                                <X size={24} color="white" />
                            </Pressable>
                            <Pressable onPress={() => setTorch(!torch)} style={styles.iconButton}>
                                {torch ? <Zap size={24} color="#FBBF24" /> : <ZapOff size={24} color="white" />}
                            </Pressable>
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </Modal>
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
