import React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Typography } from './Typography';
import { cn } from './Card';
import { Home, History, Banknote, User } from 'lucide-react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
    const insets = useSafeAreaInsets();

    return (
        <View
            className="bg-white border-t border-gray-100 flex-row items-center justify-between px-4"
            style={{
                paddingBottom: Platform.OS === 'ios' ? insets.bottom : 12,
                paddingTop: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
                elevation: 20,
            }}
        >
            {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const label = options.title !== undefined ? options.title : route.name;
                const isFocused = state.index === index;

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                    }
                };

                const onLongPress = () => {
                    navigation.emit({
                        type: 'tabLongPress',
                        target: route.key,
                    });
                };

                // Icon Mapping
                const renderIcon = (color: string) => {
                    const size = 22;
                    const strokeWidth = isFocused ? 2.5 : 2;
                    switch (route.name) {
                        case 'home': return <Home size={size} color={color} strokeWidth={strokeWidth} />;
                        case 'history': return <History size={size} color={color} strokeWidth={strokeWidth} />;
                        case 'finance': return <Banknote size={size} color={color} strokeWidth={strokeWidth} />;
                        case 'profile': return <User size={size} color={color} strokeWidth={strokeWidth} />;
                        default: return null;
                    }
                };

                return (
                    <Pressable
                        key={index}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        accessibilityLabel={options.tabBarAccessibilityLabel}
                        onPress={onPress}
                        onLongPress={onLongPress}
                        className={cn(
                            "flex-1 items-center justify-center py-1 rounded-[20px]",
                            isFocused ? "bg-primary/5" : ""
                        )}
                        activeOpacity={0.7}
                    >
                        <View className={cn("mb-1", isFocused ? "scale-110" : "scale-100 opacity-40")}>
                            {renderIcon(isFocused ? '#023C69' : '#6B7280')}
                        </View>
                        <Typography
                            variant="caption"
                            weight={isFocused ? "bold" : "medium"}
                            className={cn(
                                "text-[9px] uppercase tracking-tighter",
                                isFocused ? "text-primary" : "text-gray-400"
                            )}
                        >
                            {label}
                        </Typography>

                        {/* Indicator Dot */}
                        {isFocused && (
                            <View className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full" />
                        )}
                    </Pressable>
                );
            })}
        </View>
    );
};
