import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Platform, ScaledSize, useWindowDimensions } from 'react-native';

export type ScreenSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type DeviceOrientation = 'portrait' | 'landscape';

const BREAKPOINTS = {
    xs: 0,
    sm: 360,
    md: 640,
    lg: 1024,
    xl: 1280,
} as const;

function getScreenSize(width: number): ScreenSize {
    if (width >= BREAKPOINTS.xl) return 'xl';
    if (width >= BREAKPOINTS.lg) return 'lg';
    if (width >= BREAKPOINTS.md) return 'md';
    if (width >= BREAKPOINTS.sm) return 'sm';
    return 'xs';
}

function getOrientation(width: number, height: number): DeviceOrientation {
    return width > height ? 'landscape' : 'portrait';
}

export function useResponsive() {
    const { width, height } = useWindowDimensions();

    return useMemo(() => {
        const screenSize = getScreenSize(width);
        const orientation = getOrientation(width, height);
        const isLandscape = orientation === 'landscape';
        const isPortrait = orientation === 'portrait';
        const isMobile = width < BREAKPOINTS.md;
        const isTablet = width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
        const isDesktop = width >= BREAKPOINTS.lg;
        const isWeb = Platform.OS === 'web';
        const columns = isLandscape
            ? (width >= BREAKPOINTS.lg ? 8 : width >= BREAKPOINTS.md ? 6 : 5)
            : (width >= BREAKPOINTS.md ? 4 : 4);

        return {
            width,
            height,
            screenSize,
            orientation,
            isLandscape,
            isPortrait,
            isMobile,
            isTablet,
            isDesktop,
            isWeb,
            columns,
            breakpoints: BREAKPOINTS,
        };
    }, [width, height]);
}

/** Subscribe to dimension changes outside React tree (e.g. root layout). */
export function useDimensionsListener() {
    const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

    useEffect(() => {
        const handler = ({ window }: { window: ScaledSize }) => setDimensions(window);
        const subscription = Dimensions.addEventListener('change', handler);
        return () => subscription.remove();
    }, []);

    return dimensions;
}