import React, { useEffect } from 'react';
import { View, ViewStyle, StyleSheet, Platform, StyleProp } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    FadeInDown
} from 'react-native-reanimated';
import { cn } from '@/lib/utils'; // Assuming this utility exists, otherwise I'll use simple concat

interface GlassCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    className?: string; // For NativeWind
    delay?: number;
    variant?: 'default' | 'neon' | 'danger' | 'success';
}

export function GlassCard({
    children,
    style,
    className,
    delay = 0,
    variant = 'default'
}: GlassCardProps) {

    // Background colors with opacity for "Glass" effect
    const bgColors = {
        default: 'rgba(255, 255, 255, 0.7)', // Light mode default
        darkDefault: 'rgba(17, 24, 39, 0.7)', // Dark mode default (gray-900)
        neon: 'rgba(124, 58, 237, 0.15)', // Purple/Neon
        danger: 'rgba(239, 68, 68, 0.1)', // Red
        success: 'rgba(34, 197, 94, 0.1)', // Green
    };

    const borderColors = {
        default: 'rgba(229, 231, 235, 0.5)',
        darkDefault: 'rgba(55, 65, 81, 0.5)',
        neon: 'rgba(139, 92, 246, 0.5)',
        danger: 'rgba(248, 113, 113, 0.4)',
        success: 'rgba(74, 222, 128, 0.4)',
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify()}
            className={cn(
                "rounded-2xl border backdrop-blur-md overflow-hidden",
                className
            )}
            style={[
                styles.card,
                {
                    backgroundColor: variant === 'default' ? bgColors.darkDefault : bgColors[variant],
                    borderColor: variant === 'default' ? borderColors.darkDefault : borderColors[variant]
                },
                style
            ]}
        >
            {children}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: 16,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    }
});
