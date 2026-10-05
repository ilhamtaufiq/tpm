import React, { useState } from 'react';
import { View, Text, Pressable, Modal, Platform, TouchableOpacity } from 'react-native';
import { Calendar as LucideCalendar, X, RotateCcw } from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';
import { cn } from './Card';
import { usePlaceholderColor } from '../../utils/themeStyles';

interface DatePickerProps {
    label?: string;
    value: string; // YYYY-MM-DD or ""
    onChange: (date: string) => void;
    error?: string;
    placeholder?: string;
    required?: boolean;
    containerClassName?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
    label,
    value,
    onChange,
    error,
    placeholder = 'Pilih tanggal (YYYY-MM-DD)',
    required = false,
    containerClassName,
}) => {
    const placeholderColor = usePlaceholderColor();
    const [modalVisible, setModalVisible] = useState(false);

    const handleToday = () => {
        const today = new Date().toISOString().split('T')[0];
        onChange(today);
        setModalVisible(false);
    };

    const handleClear = () => {
        onChange('');
        setModalVisible(false);
    };

    // On Web, render a clean native HTML5 date input with custom styling matching UI Input
    if (Platform.OS === 'web') {
        return (
            <View className={cn('mb-4 w-full', containerClassName)}>
                {label && (
                    <Text className="text-textGray text-sm mb-1 font-medium">
                        {label} {required && <Text className="text-secondary">*</Text>}
                    </Text>
                )}
                <View
                    className={cn(
                        'bg-background rounded-xl px-4 py-3 border-2 border-transparent flex-row items-center justify-between',
                        error && 'border-secondary'
                    )}
                >
                    <View className="flex-row items-center flex-1 mr-2">
                        <LucideCalendar size={18} color="#64748B" className="mr-2" />
                        <input
                            type="date"
                            value={value || ''}
                            onChange={(e) => onChange(e.target.value)}
                            style={{
                                backgroundColor: 'transparent',
                                color: value ? 'inherit' : placeholderColor,
                                border: 'none',
                                outline: 'none',
                                fontSize: '16px',
                                fontFamily: 'inherit',
                                width: '100%',
                                cursor: 'pointer',
                            }}
                        />
                    </View>
                    {value ? (
                        <TouchableOpacity onPress={() => onChange('')} activeOpacity={0.7}>
                            <X size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    ) : null}
                </View>
                {error && <Text className="text-secondary text-xs mt-1">{error}</Text>}
            </View>
        );
    }

    // On Mobile (iOS / Android), render Pressable triggering Modal with react-native-calendars
    return (
        <View className={cn('mb-4 w-full', containerClassName)}>
            {label && (
                <Text className="text-textGray text-sm mb-1 font-medium">
                    {label} {required && <Text className="text-secondary">*</Text>}
                </Text>
            )}

            <Pressable
                onPress={() => setModalVisible(true)}
                className={cn(
                    'bg-background rounded-xl px-4 py-3 border-2 border-transparent flex-row items-center justify-between',
                    error && 'border-secondary'
                )}
            >
                <View className="flex-row items-center flex-1 mr-2">
                    <LucideCalendar size={18} color="#64748B" className="mr-2" />
                    <Text
                        className={cn(
                            'text-base font-normal',
                            value ? 'text-text' : 'text-textGray'
                        )}
                    >
                        {value || placeholder}
                    </Text>
                </View>
                {value ? (
                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation();
                            onChange('');
                        }}
                        activeOpacity={0.7}
                    >
                        <X size={16} color="#94A3B8" />
                    </TouchableOpacity>
                ) : null}
            </Pressable>

            {error && <Text className="text-secondary text-xs mt-1">{error}</Text>}

            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable
                    className="flex-1 bg-black/50 justify-center items-center p-4"
                    onPress={() => setModalVisible(false)}
                >
                    <Pressable
                        className="bg-surface w-full max-w-sm rounded-2xl p-4 overflow-hidden border border-border"
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View className="flex-row items-center justify-between mb-3 pb-2 border-b border-border">
                            <Text className="text-text font-bold text-base">Pilih Tanggal</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Calendar
                            current={value || new Date().toISOString().split('T')[0]}
                            onDayPress={(day: { dateString: string }) => {
                                onChange(day.dateString);
                                setModalVisible(false);
                            }}
                            markedDates={
                                value
                                    ? {
                                          [value]: {
                                              selected: true,
                                              disableTouchEvent: true,
                                              selectedColor: '#2563EB',
                                          },
                                      }
                                    : {}
                            }
                            theme={{
                                calendarBackground: 'transparent',
                                textSectionTitleColor: '#64748B',
                                selectedDayBackgroundColor: '#2563EB',
                                selectedDayTextColor: '#ffffff',
                                todayTextColor: '#2563EB',
                                dayTextColor: '#1E293B',
                                textDisabledColor: '#CBD5E1',
                                monthTextColor: '#0F172A',
                                arrowColor: '#2563EB',
                            }}
                        />

                        <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-border">
                            <TouchableOpacity
                                onPress={handleClear}
                                className="flex-row items-center px-3 py-2 bg-background rounded-xl"
                            >
                                <RotateCcw size={14} color="#64748B" className="mr-1" />
                                <Text className="text-xs text-textGray font-semibold">Kosongkan</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleToday}
                                className="px-4 py-2 bg-primary rounded-xl"
                            >
                                <Text className="text-xs text-white font-bold">Hari Ini</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};
