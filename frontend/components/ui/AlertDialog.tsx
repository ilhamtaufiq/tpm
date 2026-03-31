import React, { useRef, useEffect } from 'react';
import { View, Modal, Pressable, Text, Dimensions, Animated, Easing, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { Typography } from './Typography';
// import { Button } from './Button'; // Removed to use native Pressable implementation
import { AlertCircle, CheckCircle, Info, XCircle, LucideIcon } from 'lucide-react-native';

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
    loading = false
}: {
    onPress: () => void;
    title: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'outline-neutral';
    loading?: boolean;
}) => {
    const isOutline = variant === 'outline-neutral';

    // Determine background color
    let bgColor = '#023C69'; // Primary Default
    let borderColor = 'transparent';
    let borderWidth = 0;

    if (variant === 'danger') bgColor = '#DC2626';
    if (variant === 'secondary') bgColor = '#F59E0B'; // Warning
    if (isOutline) {
        bgColor = 'transparent';
        borderColor = '#D1D5DB'; // Gray 300
        borderWidth = 1;
    }

    // Determine text color class
    const textClass = isOutline ? 'text-gray-600' : 'text-white';
    // Determine Loading Indicator Color
    const loaderColor = isOutline ? '#4B5563' : 'white';

    return (
        <Pressable
            onPress={onPress}
            disabled={loading}
            style={({ pressed }) => [
                styles.button,
                {
                    backgroundColor: bgColor,
                    borderColor: borderColor,
                    borderWidth: borderWidth,
                    opacity: (loading || pressed) ? 0.6 : 1
                }
            ]}
        >
            {loading ? (
                <ActivityIndicator color={loaderColor} />
            ) : (
                <Typography weight="bold" className={`text-base text-center ${textClass}`}>
                    {title}
                </Typography>
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
    const { width: screenWidth, height: screenHeight } = Dimensions.get('screen');
    const scaleAnim = useRef(new Animated.Value(0)).current;
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
            case 'success': return 'bg-emerald-50 border-emerald-100';
            case 'error': return 'bg-red-50 border-red-100';
            case 'warning': return 'bg-amber-50 border-amber-100';
            default: return 'bg-blue-50 border-blue-100';
        }
    };

    return (
        <Modal
            transparent
            visible={true}
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: screenWidth,
                    height: screenHeight,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    padding: 24,
                    zIndex: 1000
                }}
            >
                <Animated.View
                    style={[
                        styles.dialogContainer,
                        {
                            transform: [{ scale: scaleAnim }],
                            opacity: opacityAnim,
                        }
                    ]}
                >
                    {/* Bento Tile Icon */}
                    <View className={`mb-6 w-20 h-20 rounded-[32px] items-center justify-center border-2 ${getIconContainerStyle()}`}>
                        {getIcon()}
                    </View>

                    <Typography variant="h2" weight="bold" className="text-center mb-2 text-gray-900 tracking-tighter">
                        {title}
                    </Typography>

                    <Typography className="text-center text-gray-500 mb-8 leading-6 text-[15px] px-2 font-medium">
                        {message}
                    </Typography>

                    <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
                        {type === 'confirm' && (
                            <View style={{ flex: 1 }}>
                                <DialogButton
                                    title={cancelText}
                                    variant="outline-neutral"
                                    onPress={onClose}
                                    loading={loading}
                                />
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <DialogButton
                                title={confirmText}
                                variant={getConfirmVariant()}
                                onPress={() => {
                                    if (onConfirm) onConfirm();
                                    else onClose();
                                }}
                                loading={loading}
                            />
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    dialogContainer: {
        width: '100%',
        maxWidth: 384,
        alignSelf: 'center',
        padding: 32,
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 48,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.1,
        shadowRadius: 30,
        elevation: 24,
    },
    button: {
        height: 56, // h-14
        borderRadius: 16, // rounded-2xl
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    }
});
