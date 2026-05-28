import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle, DimensionValue } from 'react-native';

interface SkeletonProps {
    width?: DimensionValue;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = 20,
    borderRadius = 8,
    style,
}) => {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [opacity]);

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: '#E5E7EB',
                    opacity,
                },
                style,
            ]}
        />
    );
};

// Pre-built skeleton variants
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
    <View className={`bg-white rounded-2xl p-4 mb-3 ${className || ''}`}>
        <View className="flex-row items-center">
            <Skeleton width={48} height={48} borderRadius={24} />
            <View className="flex-1 ml-3">
                <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
                <Skeleton width="40%" height={12} />
            </View>
            <Skeleton width={60} height={24} borderRadius={12} />
        </View>
    </View>
);

export const SkeletonListItem: React.FC = () => (
    <View className="flex-row items-center py-4 border-b border-gray-100">
        <Skeleton width={40} height={40} borderRadius={20} />
        <View className="flex-1 ml-3">
            <Skeleton width="70%" height={14} style={{ marginBottom: 6 }} />
            <Skeleton width="50%" height={10} />
        </View>
    </View>
);

export const SkeletonStats: React.FC = () => (
    <View className="flex-row justify-between mb-6">
        {[1, 2, 3].map((i) => (
            <View key={i} className="w-[31%] bg-white rounded-xl p-3 items-center">
                <Skeleton width={36} height={36} borderRadius={18} style={{ marginBottom: 8 }} />
                <Skeleton width={40} height={20} style={{ marginBottom: 4 }} />
                <Skeleton width={50} height={10} />
            </View>
        ))}
    </View>
);
