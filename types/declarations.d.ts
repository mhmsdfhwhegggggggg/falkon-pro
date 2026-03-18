declare module 'react-native-safe-area-context' {
    export const SafeAreaView: any;
    export const SafeAreaProvider: any;
    export const SafeAreaInsetsContext: any;
    export const SafeAreaFrameContext: any;
    export const initialWindowMetrics: any;
    export type EdgeInsets = any;
    export type Rect = any;
    export type Metrics = any;
    export function useSafeAreaInsets(): any;
    export function useSafeAreaFrame(): any;
}
declare module 'react-native-gesture-handler' {
    export const GestureHandlerRootView: any;
}
declare module 'react-native-reanimated';
declare module 'expo-router' {
    export function useRouter(): any;
    export function useLocalSearchParams<T = any>(): T;
    export const Stack: any;
    export const Tabs: any;
    export const router: any;
    export const Link: any;
}
declare module 'expo-linking' {
    export function openURL(url: string): Promise<any>;
    export function getInitialURL(): Promise<string | null>;
    export function createURL(path: string, options?: any): string;
    export function canOpenURL(url: string): Promise<boolean>;
}
declare module 'expo-status-bar';
declare module 'expo-haptics' {
    export enum ImpactFeedbackStyle {
        Light = 'light',
        Medium = 'medium',
        Heavy = 'heavy'
    }
    export function impactAsync(style?: ImpactFeedbackStyle): Promise<void>;
}
declare module '@tanstack/react-query' {
    export const QueryClient: any;
    export const QueryClientProvider: any;
}
declare module 'node-machine-id';
declare module 'react-native-webview';
declare module 'lucide-react-native' {
    export const Mail: any;
    export const Key: any;
    export const Lock: any;
    export const Smartphone: any;
    export const CheckCircle: any;
}
