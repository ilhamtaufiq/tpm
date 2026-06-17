import React, { useRef, useEffect } from 'react';
import { View, Text, useWindowDimensions, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react-native';

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

/**
 * ALERT DIALOG (STITCH UI - PREVIEW READY)
 * Full screen Absolute View implementation (Bypasses Modal touch bugs).
 */
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
    
    // Smooth Entry Animation
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
    }, [visible]);

    if (!visible) return null;

    const modalWidth = SCREEN_WIDTH > 480 ? 400 : SCREEN_WIDTH - 56;
    const isError = variant === 'error';
    const isWarning = variant === 'warning';
    
    const ui = {
        success: { color: '#10B981', bg: '#F0FDF4', icon: <CheckCircle size={32} color="#10B981" strokeWidth={2.5} /> },
        error: { color: '#E11D48', bg: '#FFF1F2', icon: <XCircle size={32} color="#E11D48" strokeWidth={2.5} /> },
        warning: { color: '#F59E0B', bg: '#FFFBEB', icon: <AlertCircle size={32} color="#F59E0B" strokeWidth={2.5} /> },
        info: { color: '#023C69', bg: '#F8FAFC', icon: <Info size={32} color="#023C69" strokeWidth={2.5} /> },
    }[variant || 'info'];

    const isConfirm = type === 'confirm';

    return (
        <View style={styles.root}>
            {/* BACKDROP: Using the proven dark overlay */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}>
                <Pressable onPress={onClose} style={styles.backdrop}>
                    <View style={styles.backdropTint} />
                </Pressable>
            </Animated.View>

            {/* CONTENT: Centered Layered View */}
            <Animated.View 
                style={[
                    styles.card, 
                    { 
                        width: modalWidth,
                        opacity: opacityAnim,
                        transform: [{ scale: scaleAnim }]
                    }
                ]}
            >
                {/* Branded Icon Container */}
                <View style={[styles.iconContainer, { backgroundColor: ui.bg, borderColor: ui.color + '20' }]}>
                    {ui.icon}
                </View>

                {/* Text Payload */}
                <Text style={styles.titleText}>{title}</Text>
                <Text style={styles.messageText}>{message}</Text>

                {/* Button Integration */}
                <View style={styles.actionsBox}>
                    {isConfirm && (
                        <View style={styles.btnWrapper}>
                            <Pressable
                                onPress={onClose}
                                style={({ pressed }) => [
                                    styles.btnBase,
                                    styles.cancelBtn,
                                    { opacity: pressed ? 0.7 : 1 }
                                ]}
                                disabled={loading}
                            >
                                <Text style={styles.cancelText}>{cancelText}</Text>
                            </Pressable>
                        </View>
                    )}
                    
                    <View style={styles.btnWrapper}>
                        <Pressable
                            onPress={() => {
                                if (onConfirm) onConfirm();
                                else onClose();
                            }}
                            disabled={loading}
                            style={({ pressed }) => [
                                styles.btnBase,
                                { backgroundColor: ui.color, opacity: pressed ? 0.8 : 1 }
                            ]}
                        >
                            <Text style={styles.confirmText}>
                                {loading ? '...' : confirmText}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999, // Maintains absolute priority
        elevation: 10,
    },
    backdrop: {
        flex: 1,
    },
    backdropTint: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)', // Premium navy-tinted backdrop
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        // High elevation for Android shadowing without using object shadow props
        elevation: 20, 
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
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 10,
        letterSpacing: -0.5,
    },
    messageText: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
        paddingHorizontal: 10,
    },
    actionsBox: {
        flexDirection: 'row',
        width: '100%',
    },
    btnWrapper: {
        flex: 1,
    },
    btnBase: {
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 5,
    },
    confirmText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    cancelBtn: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cancelText: {
        color: '#475569',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
