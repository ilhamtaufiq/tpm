import React from 'react';
import { Text, TextProps } from 'react-native';
import { cn } from './Card';

export interface TypographyProps extends Omit<TextProps, 'className'> {
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body1' | 'body2' | 'caption';
    weight?: 'normal' | 'medium' | 'semibold' | 'bold';
    className?: string;
}

export const Typography = ({
    variant = 'body1',
    weight = 'normal',
    className,
    ...props
}: TypographyProps) => {
    return (
        <Text
            className={cn(
                'text-text',
                variant === 'h1' && 'text-2xl',
                variant === 'h2' && 'text-xl',
                variant === 'h3' && 'text-lg',
                variant === 'h4' && 'text-base',
                variant === 'body1' && 'text-base',
                variant === 'body2' && 'text-sm',
                variant === 'caption' && 'text-xs text-textGray',
                weight === 'normal' && 'font-outfit',
                weight === 'medium' && 'font-outfit-medium',
                weight === 'semibold' && 'font-outfit-semibold',
                weight === 'bold' && 'font-outfit-bold',
                className
            )}
            {...props}
        />
    );
};
