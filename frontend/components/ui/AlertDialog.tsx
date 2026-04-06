import React, { useRef, useEffect, useMemo } from 'react';
import { View, Modal, Pressable, Text, useWindowDimensions, Animated, Easing, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react-native';

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

// Internal Button component with Premium Design
const DialogButton = ({
    onPress,
    title,
    variant = 'primary',
    loading = false,
    style
}: {
    onPress: () => void;
    title: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'outline-neutral';
    loading?: boolean;
    style?: any;
}) => {
    const isOutline = variant === 'outline-neutral';

    const colors = useMemo(() => {
        if (variant === 'danger') return { bg: '#E11D48', text: '#FFFFFF' };
        if (variant === 'secondary') return { bg: '#F59E0B', text: '#FFFFFF' };
        if (isOutline) return { bg: 'transparent', text: '#4B5563' };
        return { bg: '#023C69', text: '#FFFFFF' };
    }, [variant, isOutline]);

    return (
        <Pressable
            onPress={onPress}
            disabled={loading}
            style={({ pressed }) => [
                { width: '100%' },
                pressed && { opacity: 0.9 }
            ]}
        >
            {({ pressed }) => (
                <View
                    style={[
                        styles.buttonBase,
                        {
                            backgroundColor: colors.bg,
                            borderColor: isOutline ? '#E5E7EB' : 'transparent',
                            borderWidth: isOutline ? 1 : 0,
                            transform: [{ scale: pressed ? 0.98 : 1 }],
                        },
                        style
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.text} size="small" />
                    ) : (
                        <Text style={[styles.buttonText, { color: colors.text }]}>
                            {title}
                        </Text>
                    )}
                </View>
            )}
        </Pressable>
    );
};

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
    loading = false
}: AlertDialogProps) => {
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
    
    // Animation Values
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 9,
                    tension: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 250,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            scaleAnim.setValue(0.9);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    const ui = useMemo(() => {
        const size = 36;
        const variants = {
            success: { icon: <CheckCircle size={size} color="#10B981" strokeWidth={2.5} />, bg: '#ECFDF5', border: '#D1FAE5' },
            error: { icon: <XCircle size={size} color="#E11D48" strokeWidth={2.5} />, bg: '#FFF1F2', border: '#FFE4E6' },
            warning: { icon: <AlertCircle size={size} color="#F59E0B" strokeWidth={2.5} />, bg: '#FFFBEB', border: '#FEF3C7' },
            info: { icon: <Info size={size} color="#3B82F6" strokeWidth={2.5} />, bg: '#EFF6FF', border: '#DBEAFE' },
        };
        return variants[variant];
    }, [variant]);

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={[styles.overlay, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
                {/* Backdrop with fade */}
                <Animated.View 
                    style={[
                        StyleSheet.absoluteFill, 
                        { backgroundColor: 'rgba(2, 21, 38, 0.75)', opacity: opacityAnim }
                    ]}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                </Animated.View>
                
                <Animated.View
                    style={[
                        styles.container,
                        {
                            width: SCREEN_WIDTH > 480 ? 400 : SCREEN_WIDTH - 56,
                            opacity: opacityAnim,
                            transform: [{ scale: scaleAnim }],
                        }
                    ]}
                >
                    {/* Branded Icon Container */}
                    <View style={[styles.iconBox, { backgroundColor: ui.bg, borderColor: ui.border }]}>
                        {ui.icon}
                    </View>

                    {/* Text Content */}
                    <View style={styles.textGroup}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.message}>{message}</Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actions}>
                        {type === 'confirm' && (
                            <View style={styles.btnFlex}>
                                <DialogButton
                                    title={cancelText}
                                    variant="outline-neutral"
                                    onPress={onClose}
                                    loading={loading}
                                    style={{ marginRight: 6 }}
                                />
                            </View>
                        )}
                        <View style={styles.btnFlex}>
                            <DialogButton
                                title={confirmText}
                                variant={variant === 'error' ? 'danger' : variant === 'warning' ? 'secondary' : 'primary'}
                                onPress={() => {
                                    if (onConfirm) onConfirm();
                                    else onClose();
                                }}
                                loading={loading}
                                style={{ marginLeft: type === 'confirm' ? 6 : 0 }}
                            />
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 36,
        paddingTop: 44,
        paddingHorizontal: 28,
        paddingBottom: 32,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.15,
                shadowRadius: 24,
            },
            android: {
                elevation: 16,
            }
        }),
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    iconBox: {
        width: 92,
        height: 92,
        borderRadius: 34,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    textGroup: {
        alignItems: 'center',
        marginBottom: 36,
        width: '100%',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.6,
    },
    message: {
        fontSize: 16,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 8,
        fontWeight: '500',
    },
    actions: {
        flexDirection: 'row',
        width: '100%',
    },
    btnFlex: {
        flex: 1,
    },
    buttonBase: {
        height: 60,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.1,
    },
});


