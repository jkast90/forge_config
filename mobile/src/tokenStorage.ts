import AsyncStorage from '@react-native-async-storage/async-storage';
import { setTokenStorage } from './core/services/tokenStorage';
import type { TokenStorage } from './core/services/tokenStorage';

const AUTH_TOKEN_KEY = '@fc_auth_token';

class MobileTokenStorage implements TokenStorage {
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  async clearToken(): Promise<void> {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

// Install mobile token storage
setTokenStorage(new MobileTokenStorage());
