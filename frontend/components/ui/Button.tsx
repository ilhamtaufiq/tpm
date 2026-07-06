import React, { useMemo } from 'react';
import {
    Text,
    ActivityIndicator,
    View,
    Pressable,
    PressableProps,
    StyleSheet,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { cssInterop } from 'nativewind';
import { useUIStore } from '../../store/useUIStore';

cssInterop(Pressable, { className: 'style' });

export interface ButtonProps extends Omit<PressableProps, 'className' | 'style'> {
    title?: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'outline-danger' | 'outline-neutral';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    className?: string;
    style?: ViewStyle | ViewStyle[];
    icon?: React.ReactNode;
    /** @deprecated RN Pressable is always used; kept for API compatibility */
    forceNative?: boolean;
}

const SIZE_STYLES: Record<NonNullable<ButtonProps['size']>, { container: ViewStyle; text: TextStyle }> = {
    sm: { container: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 40 }, text: { fontSize: 12 } },
    md: { container: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 48 }, text: { fontSize: 14 } },
    lg: { container: { paddingHorizontal: 24, paddingVertical: 16, minHeight: 56 }, text: { fontSize: 18 } },
};

function getVariantStyles(
    variant: NonNullable<ButtonProps['variant']>,
    themeColors: { primary: string; secondary: string }
): { container: ViewStyle; text: TextStyle; spinner: string } {
    switch (variant) {
        case 'secondary':
            return {
                container: { backgroundColor: themeColors.secondary, borderWidth: 0 },
                text: { color: '#FFFFFF' },
                spinner: '#FFFFFF',
            };
        case 'danger':
            return {
                container: { backgroundColor: '#DC2626', borderWidth: 0 },
                text: { color: '#FFFFFF' },
                spinner: '#FFFFFF',
            };
        case 'outline':
            return {
                container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: themeColors.primary },
                text: { color: themeColors.primary },
                spinner: themeColors.primary,
            };
        case 'outline-danger':
            return {
                container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: themeColors.secondary },
                text: { color: themeColors.secondary },
                spinner: themeColors.secondary,
            };
        case 'outline-neutral':
            return {
                container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#D1D5DB' },
                text: { color: '#4B5563' },
                spinner: '#6B7280',
            };
        case 'ghost':
            return {
                container: { backgroundColor: 'transparent', borderWidth: 0 },
                text: { color: themeColors.primary },
                spinner: themeColors.primary,
            };
        case 'primary':
        default:
            return {
                container: { backgroundColor: themeColors.primary, borderWidth: 0 },
                text: { color: '#FFFFFF' },
                spinner: '#FFFFFF',
            };
    }
}

export const Button = ({
    title,
    variant = 'primary',
    size = 'md',
    loading = false,
    className,
    style,
    disabled,
    icon,
    forceNative: _forceNative = false,
    ...props
}: ButtonProps) => {
    const [isPressed, setIsPressed] = React.useState(false);
    const isDisabled = disabled || loading;
    const { themeColors } = useUIStore();

    const variantStyles = useMemo(() => getVariantStyles(variant, themeColors), [variant, themeColors]);
    const sizeStyles = SIZE_STYLES[size];

    const containerStyle: ViewStyle = {
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0,
        opacity: isDisabled ? 0.5 : isPressed ? 0.85 : 1,
        ...sizeStyles.container,
        ...variantStyles.container,
    };

    return (
        <Pressable
            disabled={isDisabled}
            onPressIn={() => setIsPressed(true)}
            onPressOut={() => setIsPressed(false)}
            className={className}
            style={[containerStyle, style]}
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={variantStyles.spinner} />
            ) : (
                <>
                    {icon ? <View style={title ? styles.iconSpacing : undefined}>{icon}</View> : null}
                    {title ? (
                        <Text
                            numberOfLines={2}
                            style={[styles.label, sizeStyles.text, variantStyles.text]}
                        >
                            {title}
                        </Text>
                    ) : null}
                </>
            )}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    label: {
        fontWeight: '600',
        textAlign: 'center',
        flexShrink: 1,
    },
    iconSpacing: {
        marginRight: 8,
    },
});