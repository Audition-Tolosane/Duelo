import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { dueloWS } from '../services/websocket';
import { currentAdToken } from './adToken';
import { saveToken, getToken, clearToken } from './tokenStore';

export { saveToken, getToken, clearToken };
const REQUEST_TIMEOUT_MS = 15000;
// AI generation (Forge, VO questions) legitimately takes up to a minute or two.
const SLOW_ROUTES = ['/api/forge/', '/generate-vo/'];
const SLOW_TIMEOUT_MS = 120000;

// Token refusé par le serveur (déconnexion sur un autre appareil, compte supprimé,
// expiration) : la session locale est morte, on l'oublie et on revient à l'accueil
// au lieu de laisser chaque écran afficher « Token révoqué ».
const SESSION_KEYS = ['duelo_user_id', 'duelo_pseudo', 'duelo_avatar_seed', 'duelo_avatar_url', 'duelo_consent', 'duelo_ads_npa'];
let sessionEnding = false;

async function endDeadSession() {
  if (sessionEnding) return;
  sessionEnding = true;
  try {
    dueloWS.disconnect();
    await clearToken();
    await AsyncStorage.multiRemove(SESSION_KEYS);
    router.replace('/');
  } finally {
    sessionEnding = false;
  }
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await rawAuthFetch(url, options);
  if (res.status === 401 && (await getToken())) await endDeadSession();
  return res;
}

async function rawAuthFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const adToken = currentAdToken();
  if (adToken) headers['X-Ad-Token'] = adToken;
  // Without a timeout a dead network leaves spinners turning until the OS gives up.
  if (options.signal) return fetch(url, { ...options, headers });
  const controller = new AbortController();
  const timeoutMs = SLOW_ROUTES.some((r) => url.includes(r)) ? SLOW_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
