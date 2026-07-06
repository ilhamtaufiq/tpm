import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { registerReceiptCaptureHost, ReceiptCaptureJob } from '../../utils/receiptCapture';
import { getBleRasterSpec } from '../../utils/paperSize';
import { buildBleImagePayloadFromFile } from '../../utils/bleReceiptImage';
import { ThermalReceiptView } from './ThermalReceiptView';

const CAPTURE_TIMEOUT_MS = 30000;
const LAYOUT_SETTLE_MS = 500;

export function ReceiptNativeCaptureHost() {
    const [job, setJob] = useState<ReceiptCaptureJob | null>(null);
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
        if (current && handler) {
            handler(current);
        }
    };

    useEffect(() => {
        registerReceiptCaptureHost((captureJob) => {
            jobRef.current = captureJob;
            captureStartedRef.current = false;
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
        if (!job || captureStartedRef.current) {
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
                    quality: 0.92,
                    width: raster.targetWidthPx,
                    result: 'tmpfile',
                });

                if (!tmpUri) {
                    throw new Error('Gagal capture gambar struk.');
                }

                const imagePayload = await buildBleImagePayloadFromFile(
                    tmpUri,
                    current.settings.paperSize,
                );

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
    }, [job]);

    if (!job) {
        return null;
    }

    return (
        <View style={styles.host} pointerEvents="none" collapsable={false}>
            <ThermalReceiptView
                ref={captureRefView}
                data={job.data}
                settings={job.settings}
                qrImageDataUrl={job.qrImageDataUrl}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        left: 0,
        top: 0,
        opacity: 0.01,
        zIndex: -1,
    },
});