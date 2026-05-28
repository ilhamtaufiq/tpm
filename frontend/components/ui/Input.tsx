import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { cn } from './Card';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerClassName?: string;
    innerContainerClassName?: string;
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
}

export const Input = ({ label, error, containerClassName, innerContainerClassName, className, startIcon, endIcon, ...props }: InputProps) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View className={cn('mb-4 w-full', containerClassName)}>
            {label && <Text className="text-textGray text-sm mb-1 font-medium">{label}</Text>}
            <View
                className={cn(
                    'bg-gray-100 rounded-xl px-4 py-3 border-2 border-transparent flex-row items-center',
                    isFocused && 'border-primary bg-white',
                    error && 'border-secondary',
                    innerContainerClassName
                )}
            >
                {startIcon && <View className="mr-2">{startIcon}</View>}
                <TextInput
                    className={cn('text-text text-base flex-1', className)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholderTextColor="#9CA3AF"
                    {...props}
                />
                {endIcon && <View className="ml-2">{endIcon}</View>}
            </View>
            {error && <Text className="text-secondary text-xs mt-1">{error}</Text>}
        </View>
    );
};
