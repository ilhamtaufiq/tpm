import React from 'react';
import { View } from 'react-native';
import { Typography } from './Typography';
import { formatCurrencyDisplay } from '../../utils/format';

interface FinancialRowProps {
    label: string;
    value: number;
    bold?: boolean;
    small?: boolean;
    large?: boolean;
    color?: string;
    isNegative?: boolean;
    isDark?: boolean;
    indent?: boolean;
    className?: string;
}

export const FinancialRow = React.memo(({
    label,
    value,
    bold,
    small,
    large,
    color,
    isNegative,
    isDark,
    indent,
    className
}: FinancialRowProps) => {
    const numericValue = typeof value === 'number' ? value : (Number(value) || 0);
    const isNeg = isNegative || numericValue < 0;
    const displayValue = formatCurrencyDisplay(numericValue);

    // Determine color: explicit color wins; else red for negative, else default
    let textClass = color;
    if (!textClass) {
        if (isNeg) {
            textClass = isDark ? 'text-red-400' : 'text-red-600';
        } else {
            textClass = isDark ? 'text-white' : 'text-slate-800';
        }
    }

    return (
        <View className={`flex-row items-center py-1.5 w-full ${indent ? 'pl-4' : ''} ${className || ''}`}>
            <View className="flex-1 pr-2">
                <Typography
                    variant={small ? 'caption' : 'body2'}
                    className={`${isDark ? 'text-white/70' : small ? 'text-slate-500' : 'text-slate-600'}`}
                >
                    {label}
                </Typography>
            </View>
            <Typography
                variant={large ? 'h3' : small ? 'body2' : 'body1'}
                weight={bold ? 'bold' : 'semibold'}
                className={`${textClass} flex-shrink-0`}
            >
                {displayValue}
            </Typography>
        </View>
    );
});
FinancialRow.displayName = 'FinancialRow';
