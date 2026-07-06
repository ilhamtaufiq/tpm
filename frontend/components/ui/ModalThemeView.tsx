import React from 'react';
import { View, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { vars } from 'nativewind';
import { useUIStore } from '../../store/useUIStore';

/**
 * React Native Modal renders outside the app root, so NativeWind CSS variables
 * (--color-primary, etc.) are not inherited. Wrap modal content with this view.
 */
export const ModalThemeView = ({
    children,
    style,
    className,
    ...props
}: ViewProps & { className?: string }) => {
    const { themeColors } = useUIStore();

    const theme = vars({
        '--color-primary': themeColors.primary,
        '--color-secondary': themeColors.secondary,
        '--color-background': themeColors.background,
        '--color-surface': themeColors.surface,
        '--color-text': themeColors.text,
        '--color-text-gray': themeColors.textGray,
    });

    return (
        <View style={[theme as StyleProp<ViewStyle>, style]} className={className} {...props}>
            {children}
        </View>
    );
};