import { ThemeColors, findPaletteBorder, useUIStore } from '../store/useUIStore';

/**
 * gorhom BottomSheet defaults background to white. NativeWind className
 * does not reach backgroundStyle — pass palette surface/border explicitly.
 */
export function sheetChrome(
    colors: ThemeColors,
    extra?: { borderRadius?: number; handleWidth?: number; handleHeight?: number },
) {
    return {
        backgroundStyle: {
            backgroundColor: colors.surface,
            borderRadius: extra?.borderRadius ?? 48,
        },
        handleIndicatorStyle: {
            backgroundColor: findPaletteBorder(colors),
            width: extra?.handleWidth ?? 48,
            height: extra?.handleHeight ?? 6,
        },
    };
}

export function placeholderColor(colors: ThemeColors) {
    return colors.textGray;
}

export function useSheetChrome(
    extra?: { borderRadius?: number; handleWidth?: number; handleHeight?: number },
) {
    const colors = useUIStore((s) => s.themeColors);
    return sheetChrome(colors, extra);
}

export function usePlaceholderColor() {
    return useUIStore((s) => s.themeColors.textGray);
}
