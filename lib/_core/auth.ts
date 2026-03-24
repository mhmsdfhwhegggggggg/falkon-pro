import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: Date;
};

export async function getSessionToken(): Promise<string | null> {
  try {
    // Web platform uses localStorage for token storage
    if (Platform.OS === "web") {
      return window.localStorage.getItem(SESSION_TOKEN_KEY);
    }

    // Use SecureStore for native
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    return token;
  } catch (error) {
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  try {
    // Web platform uses localStorage for token storage
    if (Platform.OS === "web") {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
      return;
    }

    // Use SecureStore for native
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  } catch (error) {
    throw error;
  }
}

export async function removeSessionToken(): Promise<void> {
  try {
    // Web platform uses localStorage for token storage
    if (Platform.OS === "web") {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
      return;
    }

    // Use SecureStore for native
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch (error) {
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    let info: string | null = null;
    if (Platform.OS === "web") {
      // Use localStorage for web
      info = window.localStorage.getItem(USER_INFO_KEY);
    } else {
      // Use SecureStore for native
      info = await SecureStore.getItemAsync(USER_INFO_KEY);
    }

    if (!info) {
      return null;
    }
    const user = JSON.parse(info);
    return user;
  } catch (error) {
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // Use localStorage for web
      window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      return;
    }

    // Use SecureStore for native
    await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
  } catch (error) {
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // Use localStorage for web
      window.localStorage.removeItem(USER_INFO_KEY);
      return;
    }

    // Use SecureStore for native
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch (error) {
  }
}

export async function clearSession(): Promise<void> {
  await removeSessionToken();
  await clearUserInfo();
}

