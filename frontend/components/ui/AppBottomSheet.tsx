import React, { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Modal, Pressable, ScrollView, Platform, BackHandler } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';

export interface AppBottomSheetRef {
    open: (index?: number) => void;
    close: () => void;
}

interface AppBottomSheetProps {
    /** Current sheet index. -1 = closed */
    index: number;
    /** Called when sheet should close (back press, backdrop tap, pan down) */
    onClose: () => void;
    /** Called when index changes (native only) */
    onIndexChange?: (index: number) => void;
    /** Snap points for native BottomSheet */
    snapPoints: (string | number)[];
    /** Content inside the sheet */
    children: React.ReactNode;
    /** Border radius for background (default: 32) */
    borderRadius?: number;
    /** Whether to use ScrollView wrapper (default: true) */
    scrollable?: boolean;
    /** Additional padding horizontal (default: 24) */
    paddingHorizontal?: number;
    /** Web modal max width (default: 640) */
    webMaxWidth?: number;
    /** Web modal height (default: '80%') */
    webHeight?: string;
}

export const AppBottomSheet = forwardRef<AppBottomSheetRef, AppBottomSheetProps>(({
    index,
    onClose,
    onIndexChange,
    snapPoints,
    children,
    borderRadius = 32,
    scrollable = true,
    paddingHorizontal = 24,
    webMaxWidth = 640,
    webHeight = '80%',
}, ref) => {
    const sheetRef = useRef<BottomSheet>(null);
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const isOpen = index !== -1;

    useImperativeHandle(ref, () => ({
        open: (snapIndex = 0) => {
            if (Platform.OS === 'web') {
                onIndexChange?.(snapIndex);
            } else {
                sheetRef.current?.snapToIndex(snapIndex);
            }
        },
        close: () => {
            if (Platform.OS === 'web') {
                onClose();
            } else {
                sheetRef.current?.close();
            }
        },
    }));

    // === Back Button Handler (Android hardware back + Web browser back/swipe) ===
    // React Navigation's beforeRemove intercepts ALL back navigation:
    // - Android hardware back button
    // - Web browser back button
    // - Web trackpad swipe-back gesture
    // - Expo Router programmatic router.back()
    useEffect(() => {
        if (!isOpen) return;

        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            // Prevent navigation — close sheet instead
            e.preventDefault();
            onClose();
        });

        return unsubscribe;
    }, [isOpen, onClose, navigation]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                pressBehavior="close"
            />
        ),
        []
    );

    const handleSheetChange = useCallback((newIndex: number) => {
        onIndexChange?.(newIndex);
        if (newIndex === -1) {
            onClose();
        }
    }, [onClose, onIndexChange]);

    // === Web: Modal-based ===
    if (Platform.OS === 'web') {
        return (
            <Modal
                visible={isOpen}
                transparent
                animationType="slide"
                onRequestClose={onClose}
            >
                <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                    <Pressable
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        onPress={onClose}
                    />
                    <View
                        className="bg-white shadow-2xl overflow-hidden"
                        style={{
                            width: '100%',
                            maxWidth: webMaxWidth,
                            height: webHeight,
                            alignSelf: 'center',
                            borderTopLeftRadius: borderRadius + 16,
                            borderTopRightRadius: borderRadius + 16,
                        }}
                    >
                        {/* Handle indicator */}
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                        {scrollable ? (
                            <ScrollView
                                contentContainerStyle={{
                                    paddingHorizontal,
                                    paddingBottom: 40,
                                }}
                            >
                                {children}
                            </ScrollView>
                        ) : (
                            <View style={{ flex: 1, paddingHorizontal }}>
                                {children}
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        );
    }

    // === Native: @gorhom/bottom-sheet ===
    return (
        <BottomSheet
            ref={sheetRef}
            index={index}
            snapPoints={snapPoints}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            backgroundStyle={{ borderRadius }}
            handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 40 }}
            onChange={handleSheetChange}
        >
            {scrollable ? (
                <BottomSheetScrollView
                    contentContainerStyle={{
                        paddingHorizontal,
                        paddingBottom: insets.bottom + 24,
                        paddingTop: 12,
                    }}
                >
                    {children}
                </BottomSheetScrollView>
            ) : (
                <View style={{ flex: 1, paddingHorizontal, paddingBottom: insets.bottom + 24, paddingTop: 12 }}>
                    {children}
                </View>
            )}
        </BottomSheet>
    );
});

AppBottomSheet.displayName = 'AppBottomSheet';
