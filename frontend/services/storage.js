import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

const storage = {
  getItem: async (key) => {
    try {
      if (isWeb) {
        return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.error(`[Storage] Error getting item for key ${key}:`, e);
      return null;
    }
  },

  setItem: async (key, value) => {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.error(`[Storage] Error setting item for key ${key}:`, e);
    }
  },

  deleteItem: async (key) => {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.error(`[Storage] Error deleting item for key ${key}:`, e);
    }
  },
};

export default storage;
