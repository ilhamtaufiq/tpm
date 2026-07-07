import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';

interface ResponsiveContainerProps extends ViewProps {
    children: React.ReactNode;
    maxWidth?: number;
    center?: boolean;
}

export const ResponsiveContainer = ({
    children,
    maxWidth,
    center = true,
    style,
    ...props
}: ResponsiveContainerProps) => {
    const { width, isDesktop, isTablet } = useResponsive();
    const resolvedMaxWidth = maxWidth ?? (isDesktop ? 1200 : isTablet ? 900 : width);

    return (
        <View
            {...props}
            style={[
                {
                    width: '100%',
                    maxWidth: resolvedMaxWidth,
                    alignSelf: center ? 'center' : undefined,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
};