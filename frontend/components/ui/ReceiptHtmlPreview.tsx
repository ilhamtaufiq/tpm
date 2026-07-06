import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { PrintReceiptData, generateReceiptHTML } from '../../utils/printReceipt';
import { PrintSettings } from '../../utils/printSettings';
import { prepareReceiptHtml } from '../../utils/prepareReceiptHtml';
import { getPaperDimensions } from '../../utils/paperSize';

interface ReceiptHtmlPreviewProps {
    data: PrintReceiptData;
    settings: PrintSettings;
    zoom?: number;
}

export const ReceiptHtmlPreview: React.FC<ReceiptHtmlPreviewProps> = ({
    data,
    settings,
    zoom = 1,
}) => {
    const [resolvedSettings, setResolvedSettings] = useState<PrintSettings>(settings);
    const paper = getPaperDimensions(settings.paperSize);
    const width = paper.widthPx * zoom;

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const prepared = await prepareReceiptHtml(data, settings);
            if (cancelled) return;
            setResolvedSettings(prepared.settings);
        })();

        return () => {
            cancelled = true;
        };
    }, [data, settings, paper.paperSize]);

    const html = useMemo(
        () => generateReceiptHTML(data, resolvedSettings),
        [data, resolvedSettings],
    );

    return (
        <View style={[styles.frame, { width }]}>
            <WebView
                originWhitelist={['*']}
                source={{ html }}
                style={{ width, minHeight: 480, backgroundColor: '#fff' }}
                scrollEnabled
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    frame: {
        backgroundColor: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
    },
});