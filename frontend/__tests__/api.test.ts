/**
 * Tests for authFetch() — the authenticated fetch wrapper.
 * Verifies:
 * - Authorization header is added when a token is stored
 * - No Authorization header when no token
 * - Request body and method are forwarded unchanged
 * - flushPendingScores doesn't throw when queue is empty
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: any[]) => mockReplace(...a) } }));
const mockDisconnect = jest.fn();
jest.mock('../services/websocket', () => ({ dueloWS: { disconnect: () => mockDisconnect() } }));

import AsyncStorage from '@react-native-async-storage/async-storage';

// Capture actual fetch calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
  });
});

afterEach(async () => {
  await AsyncStorage.clear();
  await clearToken();
});

// Import after mocks are set up
import { authFetch, saveToken, getToken, clearToken } from '../utils/api';

describe('authFetch', () => {
  it('adds Authorization header when token is stored', async () => {
    await saveToken('my-jwt-token');

    await authFetch('https://api.example.com/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/test');
    expect(options.headers['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('does NOT add Authorization header when no token', async () => {
    // No token in AsyncStorage

    await authFetch('https://api.example.com/test');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBeUndefined();
  });

  it('forwards method and body unchanged', async () => {
    await saveToken('tok');

    await authFetch('https://api.example.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: 80 }),
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/submit');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ score: 80 });
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('merges Authorization with existing headers', async () => {
    await saveToken('xyz');

    await authFetch('https://api.example.com/test', {
      headers: { 'X-Custom': 'value', 'Content-Type': 'application/json' },
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer xyz');
    expect(options.headers['X-Custom']).toBe('value');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('returns the raw fetch Response object', async () => {
    const result = await authFetch('https://api.example.com/test');
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it('propagates network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(authFetch('https://api.example.com/test')).rejects.toThrow('Network error');
  });

  it("401 avec un token : oublie la session et revient à l'accueil", async () => {
    await saveToken('revoked');
    await AsyncStorage.multiSet([['duelo_user_id', 'u1'], ['duelo_consent', '1']]);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ detail: 'Token révoqué' }) });

    const res = await authFetch('https://api.example.com/api/auth/consent', { method: 'POST' });

    expect(res.status).toBe(401);
    expect(await getToken()).toBeNull();
    expect(await AsyncStorage.getItem('duelo_user_id')).toBeNull();
    expect(await AsyncStorage.getItem('duelo_consent')).toBeNull();
    expect(mockDisconnect).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('401 sans token : ne redirige pas', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

    await authFetch('https://api.example.com/test');

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
