import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
    registerReceiptHtmlCaptureHost,
    ReceiptHtmlCaptureJob,
} from '../../utils/receiptHtmlCapture';
import { getBleRasterSpec, getPaperDimensions } from '../../utils/paperSize';
import { buildReceiptRasterHtml } from '../../utils/receiptHtmlRaster';
import { ensureHtml2CanvasCacheBaseUrl } from '../../utils/html2canvasBundle';

/** HTML/QZ path only — allow enough time for logo/QR + html2canvas. */
const CAPTURE_TIMEOUT_MS = 20000;

export function ReceiptHtmlCaptureHost() {
    const [job, setJob] = useState<ReceiptHtmlCaptureJob | null>(null);
    const [webViewBaseUrl, setWebViewBaseUrl] = useState<string | null>(null);
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
        let cancelled = false;

        ensureHtml2CanvasCacheBaseUrl()
            .then((baseUrl) => {
                if (!cancelled) {
                    setWebViewBaseUrl(baseUrl);
                }
            })
            .catch((error) => {
                console.warn('[Print] html2canvas cache setup failed:', error);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!webViewBaseUrl) {
            return undefined;
        }

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
    }, [webViewBaseUrl]);

    const handleMessage = async (event: WebViewMessageEvent) => {
        const current = jobRef.current;
        if (!current) return;

        try {
            const payload = JSON.parse(event.nativeEvent.data);

            if (payload?.type === 'height') {
                return;
            }

            if (!payload?.ok || !payload?.escPosBase64) {
                throw new Error(payload?.error || 'Gagal render struk');
            }

            const escPosBase64 = String(payload.escPosBase64);
            if (escPosBase64.length < 32) {
                throw new Error('Data printer struk kosong.');
            }

            finishJob((resolved) => resolved.resolve(escPosBase64));
        } catch (error) {
            finishJob((rejected) => {
                rejected.reject(error instanceof Error ? error : new Error(String(error)));
            });
        }
    };

    const handleWebViewError = (description: string) => {
        finishJob((rejected) => {
            rejected.reject(new Error(description));
        });
    };

    if (!job || !webViewBaseUrl) {
        return null;
    }

    const paper = getPaperDimensions(job.settings.paperSize);
    const raster = getBleRasterSpec(job.settings.paperSize);
    const rasterHtml = buildReceiptRasterHtml(job.receiptHtml, job.settings.paperSize);
    // Tall enough for long receipts, but measureHeight uses content bottom only
    // (not this host height) so we no longer print a huge blank tail.
    const webViewHeight = Math.min(raster.layoutMaxHeightPx, 1600);

    return (
        <View
            style={[styles.host, { width: paper.widthPx, height: webViewHeight }]}
            pointerEvents="none"
            collapsable={false}
        >
            <WebView
                source={{ html: rasterHtml, baseUrl: webViewBaseUrl }}
                style={{ width: paper.widthPx, height: webViewHeight, backgroundColor: '#ffffff' }}
                pointerEvents="none"
                onMessage={handleMessage}
                onError={(event) => handleWebViewError(event.nativeEvent.description || 'WebView gagal render struk.')}
                onHttpError={(event) => handleWebViewError(`WebView HTTP ${event.nativeEvent.statusCode}`)}
                originWhitelist={['*']}
                mixedContentMode="always"
                javaScriptEnabled
                domStorageEnabled
                allowFileAccess
                allowUniversalAccessFromFileURLs
                scrollEnabled={false}
                setBuiltInZoomEnabled={false}
                androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        // Off-screen but not opacity:0 — some Android WebViews skip paint when fully invisible,
        // which produced blank rasters and forced the old (different-looking) text fallback.
        position: 'absolute',
        left: 0,
        top: 0,
        opacity: 0.02,
        zIndex: -1,
        overflow: 'hidden',
        elevation: 0,
    },
});