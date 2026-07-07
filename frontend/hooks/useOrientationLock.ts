import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useUIStore, type OrientationLockMode } from '../store/useUIStore';

async function applyOrientationLock(mode: OrientationLockMode) {
    if (Platform.OS === 'web') {
        if (typeof document === 'undefined') return;

        const orientationApi = (screen as Screen & { orientation?: { lock?: (o: string) => Promise<void>; unlock?: () => void } }).orientation;
        if (!orientationApi?.lock) return;

        try {
            if (mode === 'auto') {
                orientationApi.unlock?.();
                return;
            }
            await orientationApi.lock(mode === 'landscape' ? 'landscape' : 'portrait');
        } catch {
            // Browser may block orientation lock without fullscreen gesture.
        }
        return;
    }

    try {
        if (mode === 'auto') {
            await ScreenOrientation.unlockAsync();
            return;
        }
        if (mode === 'landscape') {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            return;
        }
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (error) {
        console.warn('[Orientation] Failed to apply lock:', error);
    }
}

export function useOrientationLock() {
    const orientationLock = useUIStore((state) => state.orientationLock);
    const setOrientationLock = useUIStore((state) => state.setOrientationLock);

    useEffect(() => {
        void applyOrientationLock(orientationLock);
    }, [orientationLock]);

    const cycleOrientation = () => {
        const next: OrientationLockMode =
            orientationLock === 'portrait' ? 'landscape' :
            orientationLock === 'landscape' ? 'auto' : 'portrait';
        setOrientationLock(next);
    };

    return {
        orientationLock,
        setOrientationLock,
        cycleOrientation,
        applyOrientationLock,
    };
}