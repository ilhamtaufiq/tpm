import React from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react-native';
import { CenterModalContainer } from './BottomSheetContainer';
import { Button } from './Button';

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

const VARIANT_UI = {
    success: { color: '#10B981', bg: '#F0FDF4', icon: CheckCircle },
    error: { color: '#E11D48', bg: '#FFF1F2', icon: XCircle },
    warning: { color: '#F59E0B', bg: '#FFFBEB', icon: AlertCircle },
    info: { color: '#023C69', bg: '#F8FAFC', icon: Info },
} as const;

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

    const isConfirm = type === 'confirm';
    const modalWidth = Math.min(
        screenWidth > 480 ? 400 : screenWidth - 40,
        screenWidth - 24,
    );
    const footerBlockHeight = isConfirm ? 148 : 84;
    const chromeHeight = insets.top + insets.bottom + 48 + footerBlockHeight;
    const maxBodyHeight = Math.max(100, screenHeight - chromeHeight);

    const ui = VARIANT_UI[variant || 'info'];
    const Icon = ui.icon;

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        } else {
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <CenterModalContainer
                onClose={onClose}
                insets={insets}
                maxWidth={modalWidth}
            >
                <ScrollView
                    style={{ maxHeight: maxBodyHeight }}
                    contentContainerStyle={styles.bodyContent}
                    bounces={false}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View
                        style={[
                            styles.iconContainer,
                            { backgroundColor: ui.bg, borderColor: `${ui.color}33` },
                        ]}
                    >
                        <Icon size={32} color={ui.color} strokeWidth={2.5} />
                    </View>

                    <Text style={styles.titleText}>{title}</Text>
                    <Text style={styles.messageText}>{message}</Text>
                </ScrollView>

                <View
                    style={[styles.footer, { paddingBottom: Math.max(20, insets.bottom + 12) }]}
                    collapsable={false}
                >
                    {isConfirm ? (
                        <Button
                            title={cancelText}
                            variant="outline-neutral"
                            onPress={onClose}
                            disabled={loading}
                            size="md"
                            style={[styles.actionButton, styles.actionButtonSpaced]}
                        />
                    ) : null}

                    <Button
                        title={confirmText}
                        variant={variant === 'error' ? 'danger' : 'primary'}
                        onPress={handleConfirm}
                        disabled={loading}
                        loading={loading}
                        size="md"
                        style={[
                            styles.actionButton,
                            variant !== 'error' ? { backgroundColor: ui.color } : null,
                        ]}
                    />
                </View>
            </CenterModalContainer>
        </Modal>
    );
};

const styles = StyleSheet.create({
    bodyContent: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 12,
        alignItems: 'center',
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 2,
    },
    titleText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 8,
        width: '100%',
    },
    messageText: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
        width: '100%',
    },
    footer: {
        flexShrink: 0,
        width: '100%',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
    },
    actionButton: {
        width: '100%',
        alignSelf: 'stretch',
    },
    actionButtonSpaced: {
        marginBottom: 10,
    },
});