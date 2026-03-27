import React, { useRef, useEffect } from 'react';
import { View, Modal, Pressable, Animated, ScrollView, Platform, DimensionValue } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Typography } from './Typography';
import { X } from 'lucide-react-native';

interface BaseModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxHeight?: DimensionValue;
    showCloseButton?: boolean;
    containerClassName?: string;
}

export const BaseModal = ({
    visible,
    onClose,
    title,
    children,
    maxHeight = '80%',
    showCloseButton = true,
    containerClassName = ""
}: BaseModalProps) => {
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;

    const [shouldRender, setShouldRender] = React.useState(visible);

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
            Animated.parallel([
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    damping: 25,
                    stiffness: 200,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 300,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start(() => setShouldRender(false));
        }
    }, [visible]);

    if (!shouldRender) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View className="flex-1 justify-center items-center px-6">
                    {/* Backdrop */}
                    <Animated.View
                        style={{ opacity: opacityAnim, backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
                        className="absolute inset-0"
                    >
                        <Pressable activeOpacity={1} className="flex-1" onPress={onClose} />
                    </Animated.View>

                    {/* Modal Content */}
                    <Animated.View
                        style={{
                            transform: [{ translateY: slideAnim }],
                            opacity: opacityAnim,
                            maxHeight: maxHeight,
                            backgroundColor: 'white', // Ensure it is not transparent
                        }}
                        className={`w-full sm:max-w-md md:max-w-lg rounded-[48px] shadow-2xl overflow-hidden border border-gray-100 ${containerClassName}`}
                    >
                        {/* Header */}
                        {(title || showCloseButton) && (
                            <View className="flex-row items-center justify-between px-8 pt-8 pb-4">
                                {title ? (
                                    <Typography variant="h3" weight="bold" className="tracking-tight text-xl">
                                        {title}
                                    </Typography>
                                ) : <View />}

                                {showCloseButton && (
                                    <Pressable
                                        onPress={onClose}
                                        className="w-10 h-10 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100"
                                    >
                                        <X size={20} color="#6B7280" />
                                    </Pressable>
                                )}
                            </View>
                        )}

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 32, paddingBottom: 32, paddingTop: (title || showCloseButton) ? 0 : 32 }}
                        >
                            {children}
                        </ScrollView>
                    </Animated.View>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};
