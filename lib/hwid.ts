import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { nanoid } from 'nanoid';

const HWID_KEY = 'device_hwid';

/**
 * HWID Utility
 * Provides a unique, persistent hardware ID for the device.
 */
export async function getHardwareId(): Promise<string> {
  try {
    // 1. Try to get from Secure Storage first (most persistent)
    let hwid = null;
    
    if (Platform.OS !== 'web') {
      hwid = await SecureStore.getItemAsync(HWID_KEY);
    } else {
      hwid = localStorage.getItem(HWID_KEY);
    }

    if (hwid) return hwid;

    // 2. Generate a new one if not found
    let newHwid = '';
    
    if (Platform.OS === 'web') {
      // For web, use a combination of browser info + random ID
      const userAgent = window.navigator.userAgent;
      const screenRes = `${window.screen.width}x${window.screen.height}`;
      newHwid = `web-${nanoid(12)}-${btoa(userAgent + screenRes).substring(0, 16)}`;
    } else {
      // For Native (Expo)
      // installationId is deprecated but still provides a good fallback for consistency
      const expoId = Constants.expoConfig?.extra?.eas?.projectId || 'FALKON PRO';
      const deviceId = Constants.sessionId || nanoid(12);
      newHwid = `${Platform.OS}-${deviceId}-${expoId}`;
    }

    // 3. Persist it
    if (Platform.OS !== 'web') {
      await SecureStore.setItemAsync(HWID_KEY, newHwid);
    } else {
      localStorage.setItem(HWID_KEY, newHwid);
    }

    return newHwid;
  } catch (error) {
    console.error('[HWID] Failed to get/generate hardware ID:', error);
    return `fallback-${nanoid(8)}`;
  }
}

