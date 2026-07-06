import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import {
    registerReceiptHtmlCaptureHost,
    ReceiptHtmlCaptureJob,
} from '../../utils/receiptHtmlCapture';
import { getPaperDimensions } from '../../utils/paperSize';
import { buildReceiptRasterHtml } from '../../utils/receiptHtmlRaster';

const CAPTURE_TIMEOUT_MS = 45000;
const CAPTURE_WEBVIEW_HEIGHT = 6000;

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
            const isJpeg = dataUrl.includes('image/jpeg');
            const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
            const fileUri = `${FileSystem.cacheDirectory}tpm_receipt_${Date.now()}.${isJpeg ? 'jpg' : 'png'}`;
            await FileSystem.writeAsStringAsync(fileUri, base64, {
                encoding: FileSystem.EncodingType.Base64,
            });

            finishJob((resolved) => resolved.resolve(fileUri));
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
    const rasterHtml = buildReceiptRasterHtml(job.receiptHtml, paper);

    return (
        <View style={[styles.host, { width: paper.widthPx, height: CAPTURE_WEBVIEW_HEIGHT }]} pointerEvents="none">
            <WebView
                source={{ html: rasterHtml }}
                style={{ width: paper.widthPx, height: CAPTURE_WEBVIEW_HEIGHT, backgroundColor: '#ffffff' }}
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