import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, SafeAreaView, StatusBar, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Typography } from './Typography';
import { X, Zap, ZapOff } from 'lucide-react-native';
import { Button } from './Button';

interface BarcodeScannerModalProps {
    visible: boolean;
    onClose: () => void;
    onScan: (data: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ visible, onClose, onScan }) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [torch, setTorch] = useState(false);

    useEffect(() => {
        if (visible && !permission?.granted) {
            requestPermission();
        }
    }, [visible, permission]);

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);
        onScan(data);
        // Reset scanned state after a delay to allow another scan if needed
        setTimeout(() => setScanned(false), 2000);
    };

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
                        <TouchableOpacity onPress={onClose} className="mt-4">
                            <Typography className="text-gray-400">Batal</Typography>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.cameraContainer}>
                        <CameraView
                            style={styles.camera}
                            enableTorch={torch}
                            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                            barcodeScannerSettings={{
                                barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"],
                            }}
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
                                        {scanned && (
                                            <View style={styles.scannedIndicator}>
                                                <Typography weight="bold" style={{ color: 'white' }}>Terdeteksi!</Typography>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.unfocusedContainer}></View>
                                </View>
                                <View style={styles.unfocusedContainer}>
                                    <Typography className="text-white text-center mt-10" style={{ opacity: 0.7 }}>
                                        Posisikan barcode/QR code di dalam kotak
                                    </Typography>
                                </View>
                            </View>
                        </CameraView>

                        {/* Controls */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                                <X size={24} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setTorch(!torch)} style={styles.iconButton}>
                                {torch ? <Zap size={24} color="#FBBF24" /> : <ZapOff size={24} color="white" />}
                            </TouchableOpacity>
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
    }
});
