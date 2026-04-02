import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch } from './api';

const PENDING_KEY = 'duelo_pending_scores';
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type PendingScore = {
  challenge_id: string;
  user_id: string;
  score: number;
  correct: number;
  answers: { answer: number; is_correct: boolean; points: number; time_ms: number }[];
};

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function saveScoreWithRetry(
  challengeId: string,
  payload: { user_id: string; score: number; correct: number; answers: PendingScore['answers'] },
  retries = 3
): Promise<{ ok: boolean; data?: any }> {
  const url = `${API_URL}/api/challenges/${challengeId}/save-async-score`;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return { ok: true, data: await res.json() };
      }
    } catch {
      if (i < retries - 1) await sleep(1000 * (i + 1));
    }
  }
  // All retries failed — queue for next app launch
  await enqueuePendingScore({ challenge_id: challengeId, ...payload });
  return { ok: false };
}

async function enqueuePendingScore(entry: PendingScore) {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const queue: PendingScore[] = raw ? JSON.parse(raw) : [];
    // Avoid duplicate entries for the same challenge
    const deduped = queue.filter(q => q.challenge_id !== entry.challenge_id);
    deduped.push(entry);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(deduped));
  } catch {}
}

/**
 * Call this on app startup (e.g. in accueil.tsx useEffect) to retry failed saves.
 */
export async function flushPendingScores(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const queue: PendingScore[] = JSON.parse(raw);
    if (!queue.length) return;
    const remaining: PendingScore[] = [];
    for (const entry of queue) {
      try {
        const url = `${API_URL}/api/challenges/${entry.challenge_id}/save-async-score`;
        const res = await authFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: entry.user_id,
            score: entry.score,
            correct: entry.correct,
            answers: entry.answers,
          }),
        });
        if (!res.ok) remaining.push(entry);
      } catch {
        remaining.push(entry);
      }
    }
    if (remaining.length > 0) {
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
    } else {
      await AsyncStorage.removeItem(PENDING_KEY);
    }
  } catch {}
}
