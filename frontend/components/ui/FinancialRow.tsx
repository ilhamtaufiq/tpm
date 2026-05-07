import React from 'react';
import { View } from 'react-native';
import { Typography } from './Typography';
import { formatCurrency } from '../../utils/format';

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
}: FinancialRowProps) => (
    <View className={`flex-row justify-between items-center py-1.5 w-full ${indent ? 'pl-4' : ''} ${className || ''}`}>
        <Typography
            variant={small ? 'caption' : 'body2'}
            className={`${isDark ? 'text-white/70' : small ? 'text-slate-500' : 'text-slate-600'} flex-1 pr-2`}
        >
            {label}
        </Typography>
        <Typography
            variant={large ? 'h3' : small ? 'body2' : 'body1'}
            weight={bold ? 'bold' : 'semibold'}
            className={`${color || (isDark ? 'text-white' : 'text-slate-800')} text-right flex-shrink-0`}
        >
            {isNegative && value > 0 ? `(${formatCurrency(value)})` : formatCurrency(value || 0)}
        </Typography>
    </View>
));
FinancialRow.displayName = 'FinancialRow';
