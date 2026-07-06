import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { registerReceiptCaptureHost, ReceiptCaptureJob } from '../../utils/receiptCapture';
import { getBleRasterSpec, getPaperDimensions } from '../../utils/paperSize';
import { buildBleImagePayload } from '../../utils/bleReceiptImage';
import { ThermalReceiptView } from './ThermalReceiptView';

const CAPTURE_TIMEOUT_MS = 25000;
const LAYOUT_SETTLE_MS = 500;
const LAYOUT_FALLBACK_MS = 1500;

export function ReceiptNativeCaptureHost() {
    const [job, setJob] = useState<ReceiptCaptureJob | null>(null);
    const [layoutHeight, setLayoutHeight] = useState(0);
    const captureRefView = useRef<View>(null);
    const jobRef = useRef<ReceiptCaptureJob | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const captureStartedRef = useRef(false);

    const clearCaptureTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const clearFallbackTimer = () => {
        if (fallbackTimerRef.current) {
            clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = null;
        }
    };

    const finishJob = (handler?: (current: ReceiptCaptureJob) => void) => {
        clearCaptureTimeout();
        clearFallbackTimer();
        captureStartedRef.current = false;
        const current = jobRef.current;
        jobRef.current = null;
        setJob(null);
        setLayoutHeight(0);
        if (current && handler) {
            handler(current);
        }
    };

    useEffect(() => {
        registerReceiptCaptureHost((captureJob) => {
            jobRef.current = captureJob;
            captureStartedRef.current = false;
            setLayoutHeight(0);
            setJob(captureJob);

            clearCaptureTimeout();
            clearFallbackTimer();
            timeoutRef.current = setTimeout(() => {
                finishJob((current) => {
                    current.reject(new Error('Timeout render struk untuk printer thermal.'));
                });
            }, CAPTURE_TIMEOUT_MS);
        });

        return () => {
            registerReceiptCaptureHost(null);
            clearCaptureTimeout();
            clearFallbackTimer();
        };
    }, []);

    useEffect(() => {
        if (!job || captureStartedRef.current) {
            return undefined;
        }

        const runCapture = async () => {
            if (captureStartedRef.current || !jobRef.current) {
                return;
            }
            captureStartedRef.current = true;
            clearFallbackTimer();

            await new Promise((resolve) => setTimeout(resolve, LAYOUT_SETTLE_MS));
            if (!jobRef.current) {
                return;
            }

            const current = jobRef.current;
            const raster = getBleRasterSpec(current.settings.paperSize);

            try {
                if (!captureRefView.current) {
                    throw new Error('View struk belum siap untuk di-capture.');
                }

                const tmpUri = await captureRef(captureRefView, {
                    format: 'jpg',
                    quality: 0.9,
                    width: raster.targetWidthPx,
                    result: 'tmpfile',
                });

                if (!tmpUri) {
                    throw new Error('Gagal capture gambar struk.');
                }

                const imagePayload = await buildBleImagePayload(tmpUri, current.settings.paperSize);
                finishJob((resolved) => resolved.resolve(imagePayload));
            } catch (error) {
                finishJob((rejected) => {
                    rejected.reject(error instanceof Error ? error : new Error(String(error)));
                });
            }
        };

        const scheduleCapture = () => {
            if (!captureStartedRef.current) {
                runCapture();
            }
        };

        if (layoutHeight > 0) {
            scheduleCapture();
            return undefined;
        }

        fallbackTimerRef.current = setTimeout(scheduleCapture, LAYOUT_FALLBACK_MS);

        return () => {
            clearFallbackTimer();
        };
    }, [job, layoutHeight]);

    if (!job) {
        return null;
    }

    const paper = getPaperDimensions(job.settings.paperSize);

    return (
        <View
            style={[styles.host, { width: paper.widthPx }]}
            pointerEvents="none"
            collapsable={false}
        >
            <ThermalReceiptView
                ref={captureRefView}
                data={job.data}
                settings={job.settings}
                qrImageDataUrl={job.qrImageDataUrl}
                onLayoutHeight={(height) => {
                    if (height > 0) {
                        setLayoutHeight(height);
                    }
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        left: -10000,
        top: 0,
        opacity: 0,
        zIndex: -1,
        overflow: 'hidden',
    },
});