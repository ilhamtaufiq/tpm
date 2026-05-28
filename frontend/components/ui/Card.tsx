import React from 'react';
import { View, ViewProps } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface CardProps extends Omit<ViewProps, 'className'> {
    variant?: 'elevated' | 'outlined' | 'flat';
    className?: string;
}

export const Card = ({ className, variant = 'elevated', ...props }: CardProps) => {
    return (
        <View
            className={cn(
                'bg-surface rounded-2xl p-4',
                variant === 'elevated' && 'shadow-sm elevation-2',
                variant === 'outlined' && 'border border-gray-200',
                variant === 'flat' && 'bg-gray-50',
                className
            )}
            {...props}
        />
    );
};
