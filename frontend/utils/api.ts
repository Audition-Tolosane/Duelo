import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'duelo_token';
const REQUEST_TIMEOUT_MS = 15000;
// AI generation (Forge, VO questions) legitimately takes up to a minute or two.
const SLOW_ROUTES = ['/api/forge/', '/generate-vo/'];
const SLOW_TIMEOUT_MS = 120000;

export async function saveToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
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
