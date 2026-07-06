import React from 'react';
import { View, Pressable, ViewStyle, StyleSheet } from 'react-native';
import { ModalThemeView } from './ModalThemeView';

/** Flex backdrop — does not steal touches from the sheet panel below. */
export function ModalFlexBackdrop({ onPress, label = 'Tutup' }: { onPress: () => void; label?: string }) {
    return (
        <Pressable
            style={styles.flexBackdrop}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
        />
    );
}

export interface BottomSheetContainerProps {
    onClose: () => void;
    insets: { bottom: number };
    maxHeight?: ViewStyle['maxHeight'];
    backdropColor?: string;
    footer?: React.ReactNode;
    children: React.ReactNode;
    panelStyle?: ViewStyle;
}

export function BottomSheetContainer({
    onClose,
    insets,
    maxHeight = '78%',
    backdropColor = 'rgba(15, 23, 42, 0.38)',
    footer,
    children,
    panelStyle,
}: BottomSheetContainerProps) {
    return (
        <ModalThemeView style={[styles.root, { backgroundColor: backdropColor }]}>
            <ModalFlexBackdrop onPress={onClose} />
            <View style={[styles.panel, { maxHeight, paddingBottom: insets.bottom + 20 }, panelStyle]}>
                {children}
                {footer ? <View style={styles.footer}>{footer}</View> : null}
            </View>
        </ModalThemeView>
    );
}

/** Pinned footer area for sheets that manage their own scroll body. */
export function BottomSheetFooter({ children }: { children: React.ReactNode }) {
    return <View style={styles.footer}>{children}</View>;
}

/** Centered dialog — backdrop behind content, buttons stay tappable on Android. */
export function CenterModalContainer({
    children,
    onClose,
    insets,
    backdropColor = 'rgba(15, 23, 42, 0.45)',
    maxWidth = 400,
}: {
    children: React.ReactNode;
    onClose?: () => void;
    insets: { top: number; bottom: number };
    backdropColor?: string;
    maxWidth?: number;
}) {
    return (
        <ModalThemeView
            style={[
                styles.centerRoot,
                {
                    backgroundColor: backdropColor,
                    paddingTop: insets.top + 12,
                    paddingBottom: insets.bottom + 12,
                },
            ]}
        >
            {onClose ? (
                <Pressable style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]} onPress={onClose} />
            ) : null}
            <View style={[styles.centerContent, { maxWidth, zIndex: 2, elevation: 24 }]}>
                {children}
            </View>
        </ModalThemeView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    flexBackdrop: {
        flex: 1,
        alignSelf: 'stretch',
    },
    panel: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 20,
        paddingTop: 16,
        flexShrink: 0,
        zIndex: 2,
        elevation: 16,
        overflow: 'hidden',
    },
    footer: {
        flexShrink: 0,
        paddingTop: 12,
        backgroundColor: '#FFFFFF',
        zIndex: 3,
        elevation: 24,
    },
    centerRoot: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    centerContent: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        overflow: 'hidden',
    },
});