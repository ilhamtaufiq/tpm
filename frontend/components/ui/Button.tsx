import React from 'react';
import { Text, ActivityIndicator, View, Pressable as RNPressable, PressableProps, Platform } from 'react-native';
import { TouchableOpacity as GHPressable } from 'react-native-gesture-handler';
import { cssInterop } from 'nativewind';
import { cn } from './Card';
import { useUIStore } from '../../store/useUIStore';

// Use GH Pressable on native platforms for BottomSheet compatibility
// Use RN Pressable on web for rendering compatibility
cssInterop(GHPressable, {
    className: 'style',
});
const WrappedPressable = (Platform.OS === 'web' ? RNPressable : GHPressable) as React.ComponentType<PressableProps>;

export interface ButtonProps extends Omit<PressableProps, 'className'> {
    title?: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'outline-danger' | 'outline-neutral';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    className?: string;
    icon?: React.ReactNode;
    forceNative?: boolean;
}

export const Button = ({
    title,
    variant = 'primary',
    size = 'md',
    loading = false,
    className,
    disabled,
    icon,
    forceNative = false,
    ...props
}: ButtonProps) => {
    const [isPressed, setIsPressed] = React.useState(false);
    const isDisabled = disabled || loading;
    const { themeColors } = useUIStore();

    const Wrapper = (Platform.OS === 'web' || forceNative) ? RNPressable : WrappedPressable;

    return (
        <Wrapper
            disabled={isDisabled}
            onPressIn={() => setIsPressed(true)}
            onPressOut={() => setIsPressed(false)}
            className={cn(
                'rounded-2xl flex-row items-center justify-center',
                variant === 'primary' && 'bg-primary',
                variant === 'secondary' && 'bg-secondary',
                variant === 'danger' && 'bg-red-600',
                variant === 'outline' && 'border border-primary bg-transparent',
                variant === 'outline-danger' && 'border border-secondary bg-transparent',
                variant === 'outline-neutral' && 'border border-gray-300 bg-transparent',
                variant === 'ghost' && 'bg-transparent',
                size === 'sm' && 'px-3 py-2',
                size === 'md' && 'px-4 py-3',
                size === 'lg' && 'px-6 py-4',
                isDisabled && 'opacity-50',
                isPressed && !isDisabled && 'opacity-70',
                className
            )}
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={
                    variant === 'outline-danger' ? themeColors.secondary :
                        variant === 'outline-neutral' ? '#6B7280' :
                            variant.includes('outline') || variant === 'ghost' ? themeColors.primary : 'white'
                } />
            ) : (
                <>
                    {icon && <View className={title ? 'mr-2' : undefined}>{icon}</View>}
                    {title ? (
                        <Text
                            className={cn(
                                'font-semibold text-center',
                                ['primary', 'secondary', 'danger'].includes(variant) ? 'text-white' :
                                    variant === 'outline-danger' ? 'text-secondary' :
                                        variant === 'outline-neutral' ? 'text-gray-600' : 'text-primary',
                                size === 'sm' && 'text-xs',
                                size === 'md' && 'text-base',
                                size === 'lg' && 'text-lg'
                            )}
                        >
                            {title}
                        </Text>
                    ) : null}
                </>
            )}
        </Wrapper>
    );
};
