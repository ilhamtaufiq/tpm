import { View, Pressable as RNPressable, Platform, ScrollView } from 'react-native';
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
    scrollable?: boolean;
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
    variant = 'segmented',
    scrollable = false,
}: TabsProps) => {
    const Container = scrollable ? ScrollView : View;
    const containerProps = scrollable ? { 
        horizontal: true, 
        showsHorizontalScrollIndicator: false, 
        contentContainerStyle: { paddingRight: 24 } 
    } : {};

    return (
        <Container
            {...containerProps}
            className={cn(
                "flex-row items-center",
                variant === 'segmented' ? "bg-gray-100/80 p-1.5 rounded-[24px] border border-gray-200/50" : "gap-x-2",
                className
            )}
        >
            {items.map((item) => {
                const isActive = item.value === value;
                const Icon = item.icon;

                return (
                    <WrappedPressable
                        key={item.value}
                        onPress={() => onChange(item.value)}
                        activeOpacity={0.7}
                        className={cn(
                            "flex-row items-center justify-center py-2.5 rounded-[20px]",
                            variant === 'segmented' ? "flex-1 px-2" : "px-5",
                            isActive && variant === 'segmented' ? "bg-white shadow-sm border border-gray-100" : "",
                            isActive && variant === 'pill' ? "bg-primary border border-primary" : "",
                            !isActive && variant === 'pill' ? "bg-white border border-gray-100" : "",
                            scrollable ? "flex-none" : ""
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
                                "tracking-tight uppercase text-[9px]",
                                isActive ? (variant === 'pill' ? "text-white" : "text-[#023C69]") : "text-gray-500"
                            )}
                        >
                            {item.label}
                        </Typography>
                    </WrappedPressable>
                );
            })}
        </Container>
    );
};
