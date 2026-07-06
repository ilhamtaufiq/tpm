import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
    registerReceiptHtmlCaptureHost,
    ReceiptHtmlCaptureJob,
} from '../../utils/receiptHtmlCapture';
import { getBleRasterSpec, getPaperDimensions } from '../../utils/paperSize';
import { buildReceiptRasterHtml } from '../../utils/receiptHtmlRaster';

const CAPTURE_TIMEOUT_MS = 45000;

export function ReceiptHtmlCaptureHost() {
    const [job, setJob] = useState<ReceiptHtmlCaptureJob | null>(null);
    const jobRef = useRef<ReceiptHtmlCaptureJob | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearCaptureTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const finishJob = (handler?: (current: ReceiptHtmlCaptureJob) => void) => {
        clearCaptureTimeout();
        const current = jobRef.current;
        jobRef.current = null;
        setJob(null);
        if (current && handler) {
            handler(current);
        }
    };

    useEffect(() => {
        registerReceiptHtmlCaptureHost((captureJob) => {
            jobRef.current = captureJob;
            setJob(captureJob);

            clearCaptureTimeout();
            timeoutRef.current = setTimeout(() => {
                finishJob((current) => {
                    current.reject(new Error('Timeout render struk untuk printer thermal.'));
                });
            }, CAPTURE_TIMEOUT_MS);
        });

        return () => {
            registerReceiptHtmlCaptureHost(null);
            clearCaptureTimeout();
        };
    }, []);

    const handleMessage = async (event: WebViewMessageEvent) => {
        const current = jobRef.current;
        if (!current) return;

        try {
            const payload = JSON.parse(event.nativeEvent.data);

            if (payload?.type === 'height') {
                return;
            }

            if (!payload?.ok || !payload?.data) {
                throw new Error(payload?.error || 'Gagal render struk');
            }

            const dataUrl = String(payload.data);
            if (!dataUrl.startsWith('data:image/')) {
                throw new Error('Render struk menghasilkan format gambar tidak valid.');
            }

            finishJob((resolved) => resolved.resolve(dataUrl));
        } catch (error) {
            finishJob((rejected) => {
                rejected.reject(error instanceof Error ? error : new Error(String(error)));
            });
        }
    };

    if (!job) {
        return null;
    }

    const paper = getPaperDimensions(job.settings.paperSize);
    const raster = getBleRasterSpec(job.settings.paperSize);
    const rasterHtml = buildReceiptRasterHtml(job.receiptHtml, job.settings.paperSize);
    const webViewHeight = raster.layoutMaxHeightPx;

    return (
        <View style={[styles.host, { width: paper.widthPx, height: webViewHeight }]} pointerEvents="none">
            <WebView
                source={{ html: rasterHtml }}
                style={{ width: paper.widthPx, height: webViewHeight, backgroundColor: '#ffffff' }}
                onMessage={handleMessage}
                originWhitelist={['*']}
                mixedContentMode="always"
                javaScriptEnabled
                domStorageEnabled
                scrollEnabled={false}
                setBuiltInZoomEnabled={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        left: -5000,
        top: 0,
        opacity: 0.02,
        zIndex: -1,
        overflow: 'hidden',
    },
});