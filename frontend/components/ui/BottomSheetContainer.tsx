import React from 'react';
import {
    View,
    Pressable,
    ViewStyle,
    StyleSheet,
    useWindowDimensions,
    ScrollView,
    ScrollViewProps,
    StyleProp,
} from 'react-native';
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

/** Resolve maxHeight style value to pixels (percent of window height or absolute). */
export function resolveSheetMaxHeightPx(
    windowHeight: number,
    maxHeight: ViewStyle['maxHeight'] = '85%',
): number {
    if (typeof maxHeight === 'number' && Number.isFinite(maxHeight)) {
        return Math.min(windowHeight, maxHeight);
    }
    if (typeof maxHeight === 'string') {
        const trimmed = maxHeight.trim();
        if (trimmed.endsWith('%')) {
            const pct = parseFloat(trimmed);
            if (Number.isFinite(pct) && pct > 0) {
                return Math.round(windowHeight * (Math.min(pct, 100) / 100));
            }
        }
        const asNum = parseFloat(trimmed);
        if (Number.isFinite(asNum) && asNum > 0) {
            return Math.min(windowHeight, asNum);
        }
    }
    return Math.round(windowHeight * 0.85);
}

export interface BoundedSheetPanelProps {
    children: React.ReactNode;
    /** Fraction 0–1 or style maxHeight ('85%' | number). Default 0.88 */
    maxHeightRatio?: number;
    maxHeight?: ViewStyle['maxHeight'];
    bottomInset?: number;
    style?: StyleProp<ViewStyle>;
    className?: string;
}

/**
 * Bottom sheet white panel with a numeric maxHeight bound to the window.
 * Use with BoundedSheetScrollView so content can scroll on tablet portrait.
 */
export function BoundedSheetPanel({
    children,
    maxHeightRatio = 0.88,
    maxHeight,
    bottomInset = 0,
    style,
    className,
}: BoundedSheetPanelProps) {
    const { height: windowHeight } = useWindowDimensions();
    const maxPx = maxHeight != null
        ? resolveSheetMaxHeightPx(windowHeight, maxHeight)
        : Math.round(windowHeight * maxHeightRatio);

    return (
        <View
            className={className}
            style={[
                styles.boundedPanel,
                {
                    maxHeight: maxPx,
                    paddingBottom: Math.max(bottomInset, 12),
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

export interface BoundedSheetScrollViewProps extends ScrollViewProps {
    /** Space reserved above the scroll body (header row). Default 72 */
    headerReserve?: number;
    /** Fraction of window height for the whole sheet. Default 0.88 */
    maxHeightRatio?: number;
    /** Explicit sheet max height (overrides ratio). */
    sheetMaxHeight?: ViewStyle['maxHeight'];
    /** Safe-area / home-indicator inset at bottom of sheet. */
    bottomInset?: number;
    /** Extra padding inside scroll content bottom. Default 28 */
    contentBottomPad?: number;
}

/**
 * ScrollView with an explicit maxHeight so RN enables scrolling inside
 * maxHeight-bounded bottom sheets (fixes tablet portrait “stuck” sheets).
 */
export function BoundedSheetScrollView({
    children,
    headerReserve = 72,
    maxHeightRatio = 0.88,
    sheetMaxHeight,
    bottomInset = 0,
    contentBottomPad = 28,
    contentContainerStyle,
    style,
    keyboardShouldPersistTaps = 'handled',
    nestedScrollEnabled = true,
    showsVerticalScrollIndicator = true,
    bounces = true,
    ...rest
}: BoundedSheetScrollViewProps) {
    const { height: windowHeight } = useWindowDimensions();
    const sheetPx = sheetMaxHeight != null
        ? resolveSheetMaxHeightPx(windowHeight, sheetMaxHeight)
        : Math.round(windowHeight * maxHeightRatio);
    const scrollMax = Math.max(160, sheetPx - headerReserve - Math.max(bottomInset, 0));

    return (
        <ScrollView
            style={[{ maxHeight: scrollMax, flexGrow: 0, flexShrink: 1 }, style]}
            contentContainerStyle={[{ paddingBottom: contentBottomPad }, contentContainerStyle]}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
            nestedScrollEnabled={nestedScrollEnabled}
            showsVerticalScrollIndicator={showsVerticalScrollIndicator}
            bounces={bounces}
            {...rest}
        >
            {children}
        </ScrollView>
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
    const { height: windowHeight } = useWindowDimensions();
    const maxPx = resolveSheetMaxHeightPx(windowHeight, maxHeight);

    return (
        <ModalThemeView style={[styles.root, { backgroundColor: backdropColor }]}>
            <ModalFlexBackdrop onPress={onClose} />
            <View
                style={[
                    styles.panel,
                    {
                        maxHeight: maxPx,
                        paddingBottom: insets.bottom + 20,
                    },
                    panelStyle,
                ]}
            >
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
    const { height: screenHeight } = useWindowDimensions();
    const maxContentHeight = screenHeight - insets.top - insets.bottom - 24;

    return (
        <ModalThemeView style={[styles.centerRoot, { backgroundColor: backdropColor }]}>
            {onClose ? (
                <Pressable style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]} onPress={onClose} />
            ) : null}
            <View
                style={[
                    styles.centerContent,
                    { maxWidth, maxHeight: maxContentHeight, zIndex: 2, elevation: 24 },
                ]}
            >
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
        flexShrink: 1,
        zIndex: 2,
        elevation: 16,
        overflow: 'hidden',
    },
    boundedPanel: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 48,
        borderTopRightRadius: 48,
        overflow: 'hidden',
        flexShrink: 1,
        zIndex: 2,
        elevation: 16,
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
        flexDirection: 'column',
    },
});
