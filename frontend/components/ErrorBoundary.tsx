import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { AlertCircle } from 'lucide-react-native';

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
            return (
                <View style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 24,
                    backgroundColor: '#ffffff'
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
                        color: '#6B7280',
                        textAlign: 'center',
                        marginBottom: 24,
                        paddingHorizontal: 16
                    }}>
                        Aplikasi mengalami error yang tidak terduga. Silakan coba lagi atau hubungi tim support.
                    </Text>

                    {/* Error Details */}
                    {__DEV__ && this.state.error && (
                        <ScrollView
                            style={{
                                width: '100%',
                                maxHeight: 200,
                                marginBottom: 24,
                                backgroundColor: '#F9FAFB',
                                borderRadius: 12,
                                padding: 16,
                                borderWidth: 1,
                                borderColor: '#E5E7EB'
                            }}
                        >
                            <Text style={{
                                fontSize: 12,
                                color: '#DC2626',
                                fontFamily: 'monospace',
                                marginBottom: 8
                            }}>
                                {this.state.error.name}: {this.state.error.message}
                            </Text>
                            {this.state.error.stack && (
                                <Text style={{
                                    fontSize: 10,
                                    color: '#6B7280',
                                    fontFamily: 'monospace'
                                }}>
                                    {this.state.error.stack}
                                </Text>
                            )}
                        </ScrollView>
                    )}

                    {/* Action Buttons */}
                    <View style={{ width: '100%', gap: 12 }}>
                        <TouchableOpacity
                            onPress={this.handleReset}
                            style={{
                                backgroundColor: '#00AA13',
                                paddingVertical: 16,
                                paddingHorizontal: 32,
                                borderRadius: 12,
                                alignItems: 'center',
                                shadowColor: '#00AA13',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.2,
                                shadowRadius: 8,
                                elevation: 4,
                            }}
                        >
                            <Text style={{
                                color: 'white',
                                fontWeight: '700',
                                fontSize: 16
                            }}>
                                Coba Lagi
                            </Text>
                        </TouchableOpacity>

                        {__DEV__ && (
                            <TouchableOpacity
                                onPress={() => {
                                    console.clear();
                                    this.handleReset();
                                }}
                                style={{
                                    backgroundColor: '#F3F4F6',
                                    paddingVertical: 12,
                                    paddingHorizontal: 32,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB'
                                }}
                            >
                                <Text style={{
                                    color: '#6B7280',
                                    fontWeight: '600',
                                    fontSize: 14
                                }}>
                                    Clear Console & Retry
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Help Text */}
                    <Text style={{
                        fontSize: 12,
                        color: '#9CA3AF',
                        marginTop: 24,
                        textAlign: 'center'
                    }}>
                        Jika masalah terus berlanjut, hubungi tim support
                    </Text>
                </View>
            );
        }

        return this.props.children;
    }
}
