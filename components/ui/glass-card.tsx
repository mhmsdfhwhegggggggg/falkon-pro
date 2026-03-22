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
        default: 'rgba(255, 255, 255, 0.75)', // Light mode default
        darkDefault: 'rgba(24, 24, 27, 0.65)', // Zinc-900 with nice transparency
        neon: 'rgba(139, 92, 246, 0.12)', // Subtle Purple/Neon glow
        danger: 'rgba(225, 29, 72, 0.12)', // Rose glow
        success: 'rgba(16, 185, 129, 0.12)', // Emerald glow
    };

    const borderColors = {
        default: 'rgba(228, 228, 231, 0.6)', // Zinc-200 border
        darkDefault: 'rgba(255, 255, 255, 0.08)', // Very subtle white border for dark glass
        neon: 'rgba(139, 92, 246, 0.4)', // Purple accent border
        danger: 'rgba(244, 63, 94, 0.4)',
        success: 'rgba(16, 185, 129, 0.4)',
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
