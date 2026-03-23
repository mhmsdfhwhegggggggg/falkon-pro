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
        default: 'transparent', // Use class instead
        neon: 'rgba(139, 92, 246, 0.15)', // Subtle Purple/Neon glow
        danger: 'rgba(225, 29, 72, 0.15)', // Rose glow
        success: 'rgba(16, 185, 129, 0.15)', // Emerald glow
    };

    const borderColors = {
        default: 'transparent', // Use class instead
        neon: 'rgba(139, 92, 246, 0.5)', // Purple accent border
        danger: 'rgba(244, 63, 94, 0.5)',
        success: 'rgba(16, 185, 129, 0.5)',
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify().damping(15)}
            className={cn(
                "rounded-3xl border backdrop-blur-xl overflow-hidden shadow-2xl",
                variant === 'default' ? "glass-premium" : "",
                className
            )}
            style={[
                styles.card,
                variant !== 'default' && {
                    backgroundColor: bgColors[variant],
                    borderColor: borderColors[variant]
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
        padding: 18,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
    }
});
