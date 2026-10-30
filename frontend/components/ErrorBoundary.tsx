import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import AlertCircle from 'lucide-react-native/dist/esm/icons/circle-alert.js';
import Repeat from 'lucide-react-native/dist/esm/icons/repeat.js';
import { useMonitorStore } from '../store/useMonitorStore';
import { useUIStore, findPaletteBorder } from '../store/useUIStore';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Error caught by ErrorBoundary:', error);
        console.error('Error info:', errorInfo);
        try {
            useMonitorStore.getState().logBug(
                `React Crash: ${error.name || 'Error'}`,
                error.message,
                errorInfo?.componentStack || error.stack
            );
        } catch (e) {}
        this.setState({ errorInfo });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            const primaryColor = useUIStore.getState().themeColors?.primary || useUIStore.getState().themeColors.primary;
            return (
                <View style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 24,
                    // Class component: no hook. Read palette directly.
                    backgroundColor: useUIStore.getState().themeColors.background,
                }}>
                    {/* Error Icon */}
                    <View style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: '#FEF2F2',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 24,
                        borderWidth: 2,
                        borderColor: '#FEE2E2',
                    }}>
                        <AlertCircle size={40} color="#DC2626" strokeWidth={2} />
                    </View>

                    {/* Error Title */}
                    <Text style={{
                        fontSize: 24,
                        fontWeight: 'bold',
                        color: '#DC2626',
                        marginBottom: 8,
                        textAlign: 'center'
                    }}>
                        Oops! Terjadi Kesalahan
                    </Text>

                    {/* Error Description */}
                    <Text style={{
                        fontSize: 14,
                        color: useUIStore.getState().themeColors.textGray,
                        textAlign: 'center',
                        marginBottom: 32,
                        paddingHorizontal: 16
                    }}>
                        Aplikasi mengalami error yang tidak terduga. Silakan coba lagi atau hubungi tim support.
                    </Text>

                    {/* Action Buttons */}
                    <View style={{ width: '100%', gap: 12 }}>
                        <Pressable
                            onPress={this.handleReset}
                            style={({ pressed }) => ({
                                backgroundColor: primaryColor, // primary color
                                paddingVertical: 18,
                                paddingHorizontal: 32,
                                borderRadius: 20,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                shadowColor: primaryColor,
                                shadowOffset: { width: 0, height: 6 },
                                shadowOpacity: 0.3,
                                shadowRadius: 10,
                                elevation: 8,
                                opacity: pressed ? 0.8 : 1
                            })}
                        >
                            <Repeat size={20} color="white" />
                            <Text style={{
                                color: 'white',
                                fontWeight: '700',
                                fontSize: 16,
                                marginLeft: 10
                            }}>
                                COBA LAGI SEKARANG
                            </Text>
                        </Pressable>

                        {__DEV__ && (
                            <Pressable
                                onPress={() => {
                                    console.clear();
                                    this.handleReset();
                                }}
                                style={({ pressed }) => ({
                                    backgroundColor: useUIStore.getState().themeColors.background,
                                    paddingVertical: 16,
                                    borderRadius: 16,
                                    alignItems: 'center',
                                    marginTop: 12,
                                    opacity: pressed ? 0.7 : 1
                                })}
                            >
                                <Text style={{ color: useUIStore.getState().themeColors.textGray, fontWeight: '600' }}>Bersihkan Log & Reset</Text>
                            </Pressable>
                        )}
                    </View>

                    {/* Error Details (Only Dev) */}
                    {__DEV__ && this.state.error && (
                        <ScrollView
                            style={{
                                width: '100%',
                                maxHeight: 200,
                                marginTop: 40,
                                backgroundColor: useUIStore.getState().themeColors.background,
                                borderRadius: 12,
                                padding: 16,
                                borderWidth: 1,
                                borderColor: findPaletteBorder(useUIStore.getState().themeColors)
                            }}
                        >
                            <Text style={{
                                fontSize: 12,
                                color: '#DC2626',
                                fontWeight: 'bold',
                                marginBottom: 4
                            }}>
                                {this.state.error.name}: {this.state.error.message}
                            </Text>
                            {this.state.error.stack && (
                                <Text style={{
                                    fontSize: 10,
                                    color: useUIStore.getState().themeColors.textGray,
                                    lineHeight: 14
                                }}>
                                    {this.state.error.stack}
                                </Text>
                            )}
                        </ScrollView>
                    )}
                </View>
            );
        }

        return this.props.children;
    }
}
