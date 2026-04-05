import React, { useRef, useEffect } from 'react';
import { View, Modal, Pressable, Text, Dimensions, Animated, Easing, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { Typography } from './Typography';
import { AlertCircle, CheckCircle, Info, XCircle, LucideIcon } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

// Internal Button component using basic Pressable to avoid Modal interaction issues
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

    // Determine background color
    let bgColor = '#023C69'; // Primary Default (Dark Blue)
    let borderColor = 'transparent';
    let borderWidth = 0;
    let textColor = '#FFFFFF';

    if (variant === 'danger') {
        bgColor = '#DC2626';
    } else if (variant === 'secondary') {
        bgColor = '#F59E0B';
    } else if (isOutline) {
        bgColor = 'transparent';
        borderColor = '#D1D5DB';
        borderWidth = 1;
        textColor = '#4B5563';
    } else if (variant === 'primary') {
        bgColor = '#023C69';
    }

    // Determine Loading Indicator Color
    const loaderColor = isOutline ? '#4B5563' : 'white';

    return (
        <Pressable
            onPress={onPress}
            disabled={loading}
        >
            <View
                style={[
                    styles.button,
                    {
                        backgroundColor: bgColor,
                        borderColor: borderColor,
                        borderWidth: borderWidth,
                    },
                    style
                ]}
            >
                {loading ? (
                    <ActivityIndicator color={loaderColor} />
                ) : (
                    <Text style={{ 
                        color: textColor, 
                        fontSize: 16, 
                        fontWeight: '700', 
                        textAlign: 'center',
                    }}>
                        {title}
                    </Text>
                )}
            </View>
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
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    const [shouldRender, setShouldRender] = React.useState(visible);

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                    damping: 20,
                    stiffness: 200,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 0.9,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start(() => setShouldRender(false));
        }
    }, [visible]);

    if (!shouldRender) return null;

    const getIcon = () => {
        const size = 32;
        switch (variant) {
            case 'success':
                return <CheckCircle size={size} color="#10B981" strokeWidth={2.5} />;
            case 'error':
                return <XCircle size={size} color="#EF4444" strokeWidth={2.5} />;
            case 'warning':
                return <AlertCircle size={size} color="#F59E0B" strokeWidth={2.5} />;
            default:
                return <Info size={size} color="#3B82F6" strokeWidth={2.5} />;
        }
    };

    const getConfirmVariant = (): 'primary' | 'secondary' | 'danger' => {
        switch (variant) {
            case 'error': return 'danger';
            case 'warning': return 'secondary';
            case 'success': return 'primary';
            default: return 'primary';
        }
    };

    const getIconContainerStyle = () => {
        switch (variant) {
            case 'success': return { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' };
            case 'error': return { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' };
            case 'warning': return { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' };
            default: return { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' };
        }
    };

    return (
        <Modal
            transparent
            visible={true}
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent={Platform.OS === 'android'}
        >
            <View style={styles.centeredView}>
                <Pressable 
                    style={styles.backdrop} 
                    onPress={onClose}
                />
                <Animated.View
                    style={[
                        styles.dialogContainer,
                        {
                            transform: [{ scale: scaleAnim }],
                            opacity: opacityAnim,
                        }
                    ]}
                >
                    {/* Icon Container */}
                    <View style={[styles.iconContainer, getIconContainerStyle()]}>
                        {getIcon()}
                    </View>

                    <Text style={styles.titleText}>
                        {title}
                    </Text>

                    <Text style={styles.messageText}>
                        {message}
                    </Text>

                    <View style={styles.buttonRow}>
                        {type === 'confirm' && (
                            <View style={styles.buttonWrapper}>
                                <DialogButton
                                    title={cancelText}
                                    variant="outline-neutral"
                                    onPress={onClose}
                                    loading={loading}
                                    style={{ marginRight: 6 }}
                                />
                            </View>
                        )}
                        <View style={styles.buttonWrapper}>
                            <DialogButton
                                title={confirmText}
                                variant={getConfirmVariant()}
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
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    dialogContainer: {
        width: SCREEN_WIDTH > 448 ? 400 : SCREEN_WIDTH - 48,
        minWidth: 280,
        maxWidth: 400,
        paddingTop: 32,
        paddingHorizontal: 28,
        paddingBottom: 28,
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 28,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        overflow: 'visible',
        elevation: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    iconContainer: {
        marginBottom: 24,
        width: 80,
        height: 80,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    titleText: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    messageText: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
        paddingHorizontal: 8,
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center',
        minHeight: 56,
    },
    buttonWrapper: {
        flex: 1,
        alignItems: 'stretch',
    },
    button: {
        width: '100%',
        minHeight: 52,
        height: 52,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        includeFontPadding: false,
    }
});


