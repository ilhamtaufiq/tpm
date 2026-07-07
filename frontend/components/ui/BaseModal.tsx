import React, { useRef, useEffect } from 'react';
import { View, Modal, Pressable, Animated, ScrollView, Platform, DimensionValue } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Typography } from './Typography';
import { X } from 'lucide-react-native';
import { ModalThemeView } from './ModalThemeView';

interface BaseModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxHeight?: DimensionValue;
    showCloseButton?: boolean;
    containerClassName?: string;
    fullScreen?: boolean;
    /** Higher value stacks above other modals (web + native layering). */
    priority?: number;
}

export const BaseModal = ({
    visible,
    onClose,
    title,
    children,
    maxHeight = '80%',
    showCloseButton = true,
    containerClassName = "",
    fullScreen = false,
    priority = 1000,
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
            style={Platform.OS === 'web' ? { zIndex: priority } : undefined}
        >
            <GestureHandlerRootView style={{ flex: 1, zIndex: priority, elevation: priority }}>
                <ModalThemeView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
                    <Pressable
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
                        onPress={onClose}
                    >
                        <Animated.View
                            style={{ flex: 1, opacity: opacityAnim, backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
                        />
                    </Pressable>

                    <Animated.View
                        style={{
                            transform: [{ translateY: slideAnim }],
                            opacity: opacityAnim,
                            maxHeight: fullScreen ? '100%' : maxHeight,
                            backgroundColor: 'white',
                            width: '100%',
                            zIndex: 2,
                            elevation: 24,
                            ...(fullScreen ? { height: '100%', borderRadius: 0 } : { borderRadius: 48, borderWidth: 1, borderColor: '#F3F4F6' }),
                        }}
                        className={`${fullScreen ? '' : 'sm:max-w-md md:max-w-lg'} shadow-2xl overflow-hidden ${containerClassName}`}
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
                            style={{ flexGrow: 0, flexShrink: 1 }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingHorizontal: 32, paddingBottom: 32, paddingTop: (title || showCloseButton) ? 0 : 32 }}
                        >
                            {children}
                        </ScrollView>
                    </Animated.View>
                </ModalThemeView>
            </GestureHandlerRootView>
        </Modal>
    );
};
