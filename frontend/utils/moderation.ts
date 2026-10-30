import { authFetch } from './api';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export type ReportTarget = 'user' | 'post' | 'comment' | 'message' | 'theme';
export const REPORT_REASONS = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];

export async function reportContent(targetType: ReportTarget, targetId: string, reason: ReportReason): Promise<boolean> {
  try {
    const res = await authFetch(`${API_URL}/api/moderation/report`, {
      method: 'POST',
      body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function setBlocked(userId: string, blocked: boolean): Promise<boolean> {
  try {
    const res = await authFetch(`${API_URL}/api/moderation/block/${userId}`, { method: blocked ? 'POST' : 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchBlockedIds(): Promise<Set<string>> {
  try {
    const res = await authFetch(`${API_URL}/api/moderation/blocks`);
    if (!res.ok) return new Set();
    const list: { id: string }[] = await res.json();
    return new Set(list.map((u) => u.id));
  } catch {
    return new Set();
  }
}
