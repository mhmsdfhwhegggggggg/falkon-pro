import React from 'react';
import { View, Text } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'muted';
    className?: string;
}

export function Badge({ children, variant = 'primary', className = '' }: BadgeProps) {
    const colors = useColors();

    const getVariantStyles = () => {
        switch (variant) {
            case 'success':
                return { bg: colors.success + '15', border: colors.success + '40', text: colors.success };
            case 'warning':
                return { bg: colors.warning + '15', border: colors.warning + '40', text: colors.warning };
            case 'error':
                return { bg: colors.error + '15', border: colors.error + '40', text: colors.error };
            case 'info':
                return { bg: colors.info + '15', border: colors.info + '40', text: colors.info };
            case 'muted':
                return { bg: colors.muted + '15', border: colors.muted + '40', text: colors.muted };
            default:
                return { bg: colors.primary + '15', border: colors.primary + '40', text: colors.primary };
        }
    };

    const styles = getVariantStyles();

    return (
        <View
            className={`px-2 py-1 rounded-lg border flex-row items-center justify-center ${className}`}
            style={{ backgroundColor: styles.bg, borderColor: styles.border }}
        >
            <Text
                className="text-[10px] font-bold"
                style={{ color: styles.text }}
            >
                {children}
            </Text>
        </View>
    );
}
