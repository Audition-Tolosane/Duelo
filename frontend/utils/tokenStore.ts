import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Jeton de connexion : dans le trousseau chiffré du téléphone (Keychain iOS / Keystore Android),
// plus dans le stockage normal de l'app (lisible dans une sauvegarde ou sur un téléphone débridé).
// Sur le web, le trousseau n'existe pas : stockage normal.
// Module à part (sans dépendance vers api.ts) : websocket.ts l'utilise aussi.

const TOKEN_KEY = 'duelo_token';
const useSecure = Platform.OS !== 'web';
const SECURE_OPTS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

// Gardé en mémoire : pas de lecture du trousseau à chaque requête
let cached: string | null | undefined;

export async function saveToken(token: string) {
  cached = token;
  if (!useSecure) { await AsyncStorage.setItem(TOKEN_KEY, token); return; }
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token, SECURE_OPTS);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    await AsyncStorage.setItem(TOKEN_KEY, token);   // trousseau indisponible : on ne perd pas la session
  }
}

export async function getToken(): Promise<string | null> {
  if (cached !== undefined) return cached;
  if (!useSecure) { cached = await AsyncStorage.getItem(TOKEN_KEY); return cached; }
  let token: string | null = null;
  try { token = await SecureStore.getItemAsync(TOKEN_KEY, SECURE_OPTS); } catch { token = null; }
  if (!token) {
    // Ancienne version de l'app : jeton en clair → déplacé dans le trousseau
    const old = await AsyncStorage.getItem(TOKEN_KEY);
    if (old) {
      token = old;
      try {
        await SecureStore.setItemAsync(TOKEN_KEY, old, SECURE_OPTS);
        await AsyncStorage.removeItem(TOKEN_KEY);
      } catch { /* on réessaiera au prochain lancement */ }
    }
  }
  cached = token;
  return token;
}

export async function clearToken() {
  cached = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
  if (useSecure) {
    try { await SecureStore.deleteItemAsync(TOKEN_KEY, SECURE_OPTS); } catch {}
  }
}
