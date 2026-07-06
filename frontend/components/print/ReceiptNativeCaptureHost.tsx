import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { registerReceiptCaptureHost, ReceiptCaptureJob } from '../../utils/receiptCapture';
import { getBleRasterSpec, getPaperDimensions } from '../../utils/paperSize';
import { buildBleImagePayload } from '../../utils/bleReceiptImage';
import { ThermalReceiptView } from './ThermalReceiptView';

const CAPTURE_TIMEOUT_MS = 30000;
const LAYOUT_SETTLE_MS = 600;
const MIN_RECEIPT_HEIGHT = 120;

export function ReceiptNativeCaptureHost() {
    const [job, setJob] = useState<ReceiptCaptureJob | null>(null);
    const [layoutHeight, setLayoutHeight] = useState(0);
    const captureRefView = useRef<View>(null);
    const jobRef = useRef<ReceiptCaptureJob | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const captureStartedRef = useRef(false);

    const clearCaptureTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const finishJob = (handler?: (current: ReceiptCaptureJob) => void) => {
        clearCaptureTimeout();
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
            timeoutRef.current = setTimeout(() => {
                finishJob((current) => {
                    current.reject(new Error('Timeout render struk untuk printer thermal.'));
                });
            }, CAPTURE_TIMEOUT_MS);
        });

        return () => {
            registerReceiptCaptureHost(null);
            clearCaptureTimeout();
        };
    }, []);

    useEffect(() => {
        if (!job || captureStartedRef.current || layoutHeight < MIN_RECEIPT_HEIGHT) {
            return undefined;
        }

        captureStartedRef.current = true;
        let cancelled = false;

        const runCapture = async () => {
            await new Promise((resolve) => setTimeout(resolve, LAYOUT_SETTLE_MS));
            if (cancelled || !jobRef.current) {
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

        runCapture();

        return () => {
            cancelled = true;
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
                    if (height >= MIN_RECEIPT_HEIGHT) {
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
        top: 0,
        left: 0,
        transform: [{ translateX: -4096 }],
        opacity: 1,
        zIndex: -1,
    },
});