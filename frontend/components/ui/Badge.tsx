import React from 'react';
import { View, Text, ViewProps } from 'react-native';
import { cn } from './Card';

interface BadgeProps extends ViewProps {
    label: string;
    variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'infinity';
    textClassName?: string;
}

export const Badge = ({ label, variant = 'neutral', className, textClassName, ...props }: BadgeProps) => {
    return (
        <View
            className={cn(
                'px-2 py-1 rounded-full items-center justify-center self-start',
                variant === 'success' && 'bg-green-100',
                variant === 'warning' && 'bg-amber-100',
                variant === 'error' && 'bg-red-100',
                variant === 'info' && 'bg-blue-100',
                variant === 'neutral' && 'bg-gray-100',
                variant === 'infinity' && 'bg-indigo-100',
                className
            )}
            {...props}
        >
            <Text
                className={cn(
                    'text-[10px] font-bold uppercase',
                    variant === 'success' && 'text-green-700',
                    variant === 'warning' && 'text-amber-700',
                    variant === 'error' && 'text-red-700',
                    variant === 'info' && 'text-blue-700',
                    variant === 'neutral' && 'text-gray-700',
                    variant === 'infinity' && 'text-indigo-700',
                    textClassName
                )}
            >
                {label}
            </Text>
        </View>
    );
};
