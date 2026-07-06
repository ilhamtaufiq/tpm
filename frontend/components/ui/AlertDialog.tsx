import React, { useRef, useEffect } from 'react';
import { View, Text, useWindowDimensions, StyleSheet, Pressable, Animated, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react-native';
import { ModalThemeView } from './ModalThemeView';

interface AlertDialogProps {
    visible: boolean;
    title: string;
    message: string;
    onClose: () => void;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'success' | 'error' | 'warning' | 'info';
    type?: 'alert' | 'confirm';
    loading?: boolean;
}

export const AlertDialog = ({
    visible,
    title,
    message,
    onClose,
    onConfirm,
    confirmText = 'OK',
    cancelText = 'Batal',
    variant = 'info',
    type = 'alert',
    loading = false,
}: AlertDialogProps) => {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const opacityAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
            ]).start();
        } else {
            opacityAnim.setValue(0);
            scaleAnim.setValue(0.95);
        }
    }, [visible, opacityAnim, scaleAnim]);

    if (!visible) return null;

    const isConfirm = type === 'confirm';
    const modalWidth = Math.min(screenWidth > 480 ? 400 : screenWidth - 48, screenWidth - 32);
    const verticalPadding = 16;
    const maxCardHeight = screenHeight - insets.top - insets.bottom - verticalPadding * 2;
    const actionsHeight = isConfirm ? 156 : 92;
    const maxScrollHeight = Math.max(80, maxCardHeight - actionsHeight);

    const ui = {
        success: { color: '#10B981', bg: '#F0FDF4', icon: <CheckCircle size={32} color="#10B981" strokeWidth={2.5} /> },
        error: { color: '#E11D48', bg: '#FFF1F2', icon: <XCircle size={32} color="#E11D48" strokeWidth={2.5} /> },
        warning: { color: '#F59E0B', bg: '#FFFBEB', icon: <AlertCircle size={32} color="#F59E0B" strokeWidth={2.5} /> },
        info: { color: '#023C69', bg: '#F8FAFC', icon: <Info size={32} color="#023C69" strokeWidth={2.5} /> },
    }[variant || 'info'];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <ModalThemeView
                style={[
                    styles.overlay,
                    {
                        paddingTop: insets.top + verticalPadding,
                        paddingBottom: insets.bottom + verticalPadding,
                        paddingHorizontal: 16,
                    },
                ]}
            >
                <Pressable
                    style={[StyleSheet.absoluteFillObject, styles.backdropPressable]}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Tutup dialog"
                >
                    <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: opacityAnim }]} />
                </Pressable>

                <Animated.View
                    style={[
                        styles.card,
                        {
                            width: modalWidth,
                            maxHeight: maxCardHeight,
                            opacity: opacityAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    <ScrollView
                        bounces={false}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={false}
                        style={[styles.scrollArea, { maxHeight: maxScrollHeight }]}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={[styles.iconContainer, { backgroundColor: ui.bg, borderColor: `${ui.color}20` }]}>
                            {ui.icon}
                        </View>
                        <Text style={styles.titleText}>{title}</Text>
                        <Text style={styles.messageText}>{message}</Text>
                    </ScrollView>

                    <View style={styles.actionsBox} collapsable={false}>
                        {isConfirm ? (
                            <Pressable
                                onPress={onClose}
                                disabled={loading}
                                style={({ pressed }) => [
                                    styles.btnBase,
                                    styles.cancelBtn,
                                    styles.btnFullWidth,
                                    { opacity: pressed ? 0.7 : 1 },
                                ]}
                            >
                                <Text style={styles.cancelText} numberOfLines={1}>
                                    {cancelText}
                                </Text>
                            </Pressable>
                        ) : null}

                        <Pressable
                            onPress={() => {
                                if (onConfirm) onConfirm();
                                else onClose();
                            }}
                            disabled={loading}
                            style={({ pressed }) => [
                                styles.btnBase,
                                styles.btnFullWidth,
                                { backgroundColor: ui.color, opacity: pressed ? 0.8 : 1 },
                            ]}
                        >
                            <Text style={styles.confirmText} numberOfLines={1}>
                                {loading ? '...' : confirmText}
                            </Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </ModalThemeView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdropPressable: {
        zIndex: 0,
    },
    backdrop: {
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        elevation: 24,
        zIndex: 2,
        flexDirection: 'column',
        overflow: 'hidden',
    },
    scrollArea: {
        flexGrow: 0,
        flexShrink: 1,
        minHeight: 0,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 8,
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        borderWidth: 2,
    },
    titleText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 10,
        letterSpacing: -0.5,
    },
    messageText: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 4,
    },
    actionsBox: {
        flexDirection: 'column',
        width: '100%',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        backgroundColor: '#FFFFFF',
        flexShrink: 0,
        zIndex: 3,
        elevation: 24,
    },
    btnFullWidth: {
        width: '100%',
        alignSelf: 'stretch',
    },
    btnBase: {
        minHeight: 52,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    confirmText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 15,
    },
    cancelBtn: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cancelText: {
        color: '#475569',
        fontWeight: 'bold',
        fontSize: 15,
    },
});