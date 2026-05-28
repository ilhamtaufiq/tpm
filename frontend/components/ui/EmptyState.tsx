import React from 'react';
import { View } from 'react-native';
import { Typography } from './Typography';
import { Button } from './Button';
import { AlertCircle, Inbox, Search, WifiOff } from 'lucide-react-native';

interface EmptyStateProps {
    icon?: 'empty' | 'search' | 'error' | 'offline' | React.ComponentType<any>;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}

const icons = {
    empty: Inbox,
    search: Search,
    error: AlertCircle,
    offline: WifiOff,
};

const iconColors = {
    empty: '#9CA3AF',
    search: '#9CA3AF',
    error: '#EF4444',
    offline: '#F59E0B',
};

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon = 'empty',
    title,
    description,
    actionLabel,
    onAction,
}) => {
    const isCustomIcon = typeof icon !== 'string';
    const IconComponent = isCustomIcon ? icon : icons[icon as keyof typeof icons] || Inbox;
    const iconColor = isCustomIcon ? '#9CA3AF' : iconColors[icon as keyof typeof iconColors] || '#9CA3AF';

    return (
        <View className="flex-1 items-center justify-center py-16 px-8">
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-6">
                <IconComponent size={40} color={iconColor} />
            </View>
            <Typography variant="h3" weight="semibold" className="text-center mb-2">
                {title}
            </Typography>
            {description && (
                <Typography className="text-center text-gray-500 mb-6">
                    {description}
                </Typography>
            )}
            {actionLabel && onAction && (
                <Button title={actionLabel} onPress={onAction} variant="outline" />
            )}
        </View>
    );
};
