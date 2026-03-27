import React from 'react';
import { View, Pressable as RNPressable, Platform } from 'react-native';
import { Typography } from './Typography';
import { cn } from './Card';
import { cssInterop } from 'nativewind';
import { TouchableOpacity as GHPressable } from 'react-native-gesture-handler';

// Use same pressable logic as Button for consistency
cssInterop(GHPressable, {
    className: 'style',
});
const WrappedPressable = (Platform.OS === 'web' ? RNPressable : GHPressable) as React.ComponentType<any>;

interface TabItem {
    label: string;
    value: string;
    icon?: any;
}

interface TabsProps {
    items: TabItem[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
    variant?: 'pill' | 'segmented';
}

/**
 * Premium Tabs component following the Stitch UI design system.
 * Uses bento-style rounded corners and subtle glassmorphic touches.
 */
export const Tabs = ({
    items,
    value,
    onChange,
    className,
    variant = 'segmented'
}: TabsProps) => {
    return (
        <View className={cn(
            "flex-row items-center",
            variant === 'segmented' ? "bg-gray-100/80 p-1.5 rounded-[24px] border border-gray-200/50" : "gap-2",
            className
        )}>
            {items.map((item) => {
                const isActive = item.value === value;
                const Icon = item.icon;

                return (
                    <WrappedPressable
                        key={item.value}
                        onPress={() => onChange(item.value)}
                        activeOpacity={0.7}
                        className={cn(
                            "flex-1 flex-row items-center justify-center py-3 rounded-[18px]",
                            isActive && variant === 'segmented' ? "bg-white shadow-sm border border-gray-100" : "",
                            isActive && variant === 'pill' ? "bg-primary px-5" : "",
                            !isActive && variant === 'pill' ? "bg-white border border-gray-100 px-5" : ""
                        )}
                    >
                        {Icon && (
                            <View className={cn("mr-2", isActive ? "opacity-100" : "opacity-40")}>
                                <Icon
                                    size={16}
                                    color={isActive ? (variant === 'pill' ? "white" : "#023C69") : "#6B7280"}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                            </View>
                        )}
                        <Typography
                            variant="caption"
                            weight={isActive ? "bold" : "medium"}
                            className={cn(
                                "tracking-tight uppercase text-[10px]",
                                isActive ? (variant === 'pill' ? "text-white" : "text-primary") : "text-gray-400"
                            )}
                        >
                            {item.label}
                        </Typography>
                    </WrappedPressable>
                );
            })}
        </View>
    );
};
