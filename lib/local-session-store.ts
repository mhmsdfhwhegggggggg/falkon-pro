import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface LocalAccount {
  id: string;
  phoneNumber: string;
  sessionString: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  isActive: boolean;
  warmingLevel: number;
}

const ACCOUNTS_LIST_KEY = 'falkon_pro_accounts_list';
const SESSION_PREFIX = 'falkon_pro_session_';

export async function getLocalAccounts(): Promise<LocalAccount[]> {
  try {
    if (Platform.OS === 'web') {
      const stored = localStorage.getItem(ACCOUNTS_LIST_KEY);
      return stored ? JSON.parse(stored) : [];
    }
    
    const stored = await SecureStore.getItemAsync(ACCOUNTS_LIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to get local accounts', error);
    return [];
  }
}

export async function saveLocalAccounts(accounts: LocalAccount[]): Promise<void> {
  try {
    // We only store metadata in the list, removing the heavy session strings to avoid size limits
    const metadataOnly = accounts.map(acc => ({
      ...acc,
      sessionString: '' // Don't store the session string in the main list
    }));
    
    if (Platform.OS === 'web') {
      localStorage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(metadataOnly));
    } else {
      await SecureStore.setItemAsync(ACCOUNTS_LIST_KEY, JSON.stringify(metadataOnly));
    }
    
    // Save session strings individually to avoid size limits
    for (const acc of accounts) {
      if (acc.sessionString) {
        await saveSessionString(acc.phoneNumber, acc.sessionString);
      }
    }
  } catch (error) {
    console.error('Failed to save local accounts', error);
  }
}

export async function saveSessionString(phoneNumber: string, sessionString: string): Promise<void> {
  try {
    const key = `${SESSION_PREFIX}${phoneNumber.replace(/\+/g, '')}`;
    if (Platform.OS === 'web') {
      localStorage.setItem(key, sessionString);
    } else {
      await SecureStore.setItemAsync(key, sessionString);
    }
  } catch (error) {
    console.error('Failed to save session for', phoneNumber, error);
  }
}

export async function getSessionString(phoneNumber: string): Promise<string | null> {
  try {
    const key = `${SESSION_PREFIX}${phoneNumber.replace(/\+/g, '')}`;
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    return null;
  }
}

export async function addLocalAccount(account: LocalAccount): Promise<void> {
  const accounts = await getLocalAccounts();
  const existingIndex = accounts.findIndex(a => a.phoneNumber === account.phoneNumber);
  
  if (existingIndex >= 0) {
    accounts[existingIndex] = { ...accounts[existingIndex], ...account };
  } else {
    accounts.push(account);
  }
  
  await saveLocalAccounts(accounts);
}

export async function removeLocalAccount(phoneNumber: string): Promise<void> {
  const accounts = await getLocalAccounts();
  const filtered = accounts.filter(a => a.phoneNumber !== phoneNumber);
  await saveLocalAccounts(filtered);
  
  // also clear session string
  try {
    const key = `${SESSION_PREFIX}${phoneNumber.replace(/\+/g, '')}`;
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch(e) {}
}

export const localSessionStore = {
  getAccountSession: async (accountId: number | string): Promise<string | undefined> => {
    const accounts = await getLocalAccounts();
    const account = accounts.find(a => String(a.id) === String(accountId));
    if (account && account.phoneNumber) {
       const session = await getSessionString(account.phoneNumber);
       return session || undefined;
    }
    return undefined;
  },
  saveAccountSession: async (accountId: number | string, sessionString: string): Promise<void> => {
    const accounts = await getLocalAccounts();
    const account = accounts.find(a => String(a.id) === String(accountId));
    if (account && account.phoneNumber) {
      await saveSessionString(account.phoneNumber, sessionString);
    }
  }
};
