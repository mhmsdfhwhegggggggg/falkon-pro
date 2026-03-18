// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "bubble.left": "chat-bubble-outline",
  "bubble.left.fill": "chat-bubble",
  "plus": "add",
  "minus": "remove",
  "checkmark": "check",
  "xmark": "close",
  "arrow.right": "arrow-forward",
  "arrow.left": "arrow-back",
  "gear": "settings",
  "person": "person",
  "list.bullet": "list",
  "magnifyingglass": "search",
  "trash": "delete",
  "square.and.pencil": "edit",
  "square.and.arrow.up": "share",
  "bell": "notifications",
  "lock": "lock",
  "lock.open": "lock-open",
  "eye": "visibility",
  "eye.slash": "visibility-off",
  "heart": "favorite",
  "heart.fill": "favorite",
  "star": "star",
  "star.fill": "star",
  "message": "mail",
  "phone": "phone",
  "camera": "camera",
  "photo": "photo",
  "video": "videocam",
  "music.note": "music-note",
  "globe": "public",
  "shield": "security",
  "cloud": "cloud",
  "cloud.download": "cloud-download",
  "cloud.upload": "cloud-upload",
  "folder": "folder",
  "folder.open": "folder-open",
  "doc.text": "document-text",
  "calendar": "calendar-today",
  "clock": "schedule",
  "location": "location-on",
  "cart": "shopping-cart",
  "creditcard": "payment",
  "info.circle": "info",
  "warning": "warning",
  "exclamationmark.triangle": "warning",
  "checkmark.circle": "check-circle",
  "xmark.circle": "cancel",
  "questionmark.circle": "help",
} as any;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
