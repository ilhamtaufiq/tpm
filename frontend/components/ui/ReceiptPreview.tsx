import React, { useState } from 'react';
import { View, ScrollView, Modal, Pressable, Platform } from 'react-native';
import { X, Printer, Download, ZoomIn, ZoomOut } from 'lucide-react-native';
import { Typography } from './Typography';
import { Button } from './Button';
import { PrintReceiptData } from '../../utils/printReceipt';
import { PrintSettings } from '../../utils/printSettings';
import { ReceiptHtmlPreview } from './ReceiptHtmlPreview';
import { getPaperDimensions } from '../../utils/paperSize';

interface ReceiptPreviewProps {
    visible: boolean;
    onClose: () => void;
    onPrint: () => void;
    onSavePDF: () => void;
    data: PrintReceiptData;
    settings: PrintSettings;
    loading?: boolean;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
    visible,
    onClose,
    onPrint,
    onSavePDF,
    data,
    settings,
    loading = false,
}) => {
    const [zoom, setZoom] = useState(1);
    const paper = getPaperDimensions(settings.paperSize);

    return (
        <Modal
            visible={visible}
            transparent={Platform.OS !== 'android'}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/80">
                <View className="bg-surface px-6 py-4 flex-row items-center justify-between border-b border-gray-200">
                    <Typography variant="h3" weight="bold">Preview Struk</Typography>
                    <View className="flex-row items-center" style={{ gap: 12 }}>
                        <Pressable
                            onPress={() => setZoom(Math.max(0.5, zoom - 0.25))}
                            className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center"
                        >
                            <ZoomOut size={20} color="#374151" />
                        </Pressable>
                        <Typography variant="caption" weight="medium" className="text-textGray">
                            {Math.round(zoom * 100)}%
                        </Typography>
                        <Pressable
                            onPress={() => setZoom(Math.min(2, zoom + 0.25))}
                            className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center"
                        >
                            <ZoomIn size={20} color="#374151" />
                        </Pressable>
                        <Pressable
                            onPress={onClose}
                            className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center ml-2"
                        >
                            <X size={20} color="#374151" />
                        </Pressable>
                    </View>
                </View>

                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{
                        padding: 24,
                        alignItems: 'center',
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    <View
                        style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 8,
                        }}
                    >
                        <ReceiptHtmlPreview data={data} settings={settings} zoom={zoom} />
                    </View>
                    <Typography variant="caption" className="text-white/60 mt-3">
                        Preview sama dengan struk web/QZ Tray ({paper.paperSize})
                    </Typography>
                </ScrollView>

                <View className="bg-surface px-6 py-4 border-t border-gray-200" style={{ gap: 12 }}>
                    <Button
                        title="Cetak Struk"
                        onPress={onPrint}
                        loading={loading}
                        icon={<Printer size={20} color="white" />}
                        className="h-14 rounded-2xl"
                    />
                    <Button
                        variant="outline"
                        title="Simpan PDF"
                        onPress={onSavePDF}
                        loading={loading}
                        icon={<Download size={20} color="#023C69" />}
                        className="h-14 rounded-2xl"
                    />
                </View>
            </View>
        </Modal>
    );
};