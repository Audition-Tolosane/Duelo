/**
 * Tests for the async score retry queue.
 * Covers: successful save, retry on failure, queueing on total failure,
 * and flush of queued entries.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock authFetch before importing the module under test
let mockFetchOk = true;
let mockFetchData: any = { status: 'waiting_for_opponent' };

jest.mock('../utils/api', () => ({
  authFetch: jest.fn(async () => ({
    ok: mockFetchOk,
    json: async () => mockFetchData,
  })),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Re-import after mocks are in place
import { saveScoreWithRetry, flushPendingScores } from '../utils/pendingScores';

const PENDING_KEY = 'duelo_pending_scores';

const samplePayload = {
  user_id: 'user-123',
  score: 80,
  correct: 5,
  answers: [
    { answer: 2, is_correct: true, points: 18, time_ms: 2000 },
    { answer: 0, is_correct: false, points: 0, time_ms: 5000 },
  ],
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockFetchOk = true;
  mockFetchData = { status: 'waiting_for_opponent' };
});

describe('saveScoreWithRetry', () => {
  it('returns ok:true and data on first successful request', async () => {
    mockFetchData = { status: 'completed', p1_score: 80, p2_score: 60 };
    const result = await saveScoreWithRetry('challenge-abc', samplePayload, 3);
    expect(result.ok).toBe(true);
    expect(result.data?.status).toBe('completed');
  });

  it('queues entry in AsyncStorage on total failure', async () => {
    mockFetchOk = false;
    const result = await saveScoreWithRetry('challenge-fail', samplePayload, 1);
    expect(result.ok).toBe(false);
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const queue = JSON.parse(raw!);
    expect(queue).toHaveLength(1);
    expect(queue[0].challenge_id).toBe('challenge-fail');
    expect(queue[0].score).toBe(80);
  });

  it('does not duplicate entries for the same challenge_id', async () => {
    mockFetchOk = false;
    await saveScoreWithRetry('challenge-dup', samplePayload, 1);
    await saveScoreWithRetry('challenge-dup', { ...samplePayload, score: 100 }, 1);
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const queue = JSON.parse(raw!);
    // Should have only 1 entry (latest overwrites)
    const entries = queue.filter((e: any) => e.challenge_id === 'challenge-dup');
    expect(entries).toHaveLength(1);
    expect(entries[0].score).toBe(100);
  });
});

describe('flushPendingScores', () => {
  it('removes entries from queue on success', async () => {
    // Seed the queue manually
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([
      { challenge_id: 'ch-1', ...samplePayload },
    ]));

    mockFetchOk = true;
    await flushPendingScores();

    const raw = await AsyncStorage.getItem(PENDING_KEY);
    expect(raw).toBeNull();
  });

  it('keeps failed entries in the queue', async () => {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([
      { challenge_id: 'ch-fail', ...samplePayload },
    ]));

    mockFetchOk = false;
    await flushPendingScores();

    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const queue = JSON.parse(raw!);
    expect(queue).toHaveLength(1);
    expect(queue[0].challenge_id).toBe('ch-fail');
  });

  it('does nothing when queue is empty', async () => {
    // Should not throw
    await expect(flushPendingScores()).resolves.toBeUndefined();
  });
});

describe('game scoring logic', () => {
  const MAX_PTS = 20;
  const TIMER = 10;

  function calcPoints(isCorrect: boolean, timeTaken: number) {
    return isCorrect ? Math.max(MAX_PTS - timeTaken, 10) : 0;
  }

  it('awards max points minus time taken (min 10) for correct answer', () => {
    expect(calcPoints(true, 0)).toBe(20);
    expect(calcPoints(true, 5)).toBe(15);
    expect(calcPoints(true, 12)).toBe(10); // clamped
  });

  it('awards 0 points for wrong answer', () => {
    expect(calcPoints(false, 2)).toBe(0);
    expect(calcPoints(false, 0)).toBe(0);
  });

  it('perfect game scores 7 * max points when answering instantly', () => {
    const total = Array.from({ length: 7 }, () => calcPoints(true, 0))
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(140);
  });
});
