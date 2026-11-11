import { useEffect, useState } from 'react';
import { authFetch } from './api';
import { t } from './i18n';

// Économie de jeu (crédits, places de thèmes, coffre) — règles côté serveur : backend/routers/economy.py.
// Un petit état partagé : l'en-tête, l'écran de recherche et le coffre lisent la même valeur,
// et toute réponse du serveur la remplace (pas de calcul local des crédits).

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export type EconomyStatus = {
  credits: number;
  credits_max: number;
  next_credit_at: string | null;
  credits_per_ad: number;
  credit_ads_left: number;
  free_play: boolean;
  free_until: string | null;
  themes_used: number;
  themes_limit: number;
  themes_per_ad: number;
  chest_free: boolean;
  chest_ad: boolean;
  theme_allowed?: boolean;
};

export type ChestReward = { type: 'credits' | 'xp' | 'boost'; value: number; theme_id?: string | null };

let current: EconomyStatus | null = null;
const listeners = new Set<(s: EconomyStatus | null) => void>();

function publish(s: EconomyStatus | null) {
  current = s;
  listeners.forEach((l) => l(s));
}

function pickStatus(data: any): EconomyStatus | null {
  return data && typeof data.credits === 'number' ? (data as EconomyStatus) : null;
}

/** État partagé, rafraîchi au montage du premier abonné. */
export function useEconomy(): EconomyStatus | null {
  const [s, setS] = useState(current);
  useEffect(() => {
    listeners.add(setS);
    if (!current) refreshEconomy();
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export async function refreshEconomy(themeId?: string): Promise<EconomyStatus | null> {
  try {
    const qs = themeId ? `?theme_id=${encodeURIComponent(themeId)}` : '';
    const res = await authFetch(`${API_URL}/api/economy/status${qs}`);
    if (!res.ok) return current;
    const s = pickStatus(await res.json());
    if (s) publish(s);
    return s;
  } catch {
    return current;
  }
}

export type PlayCheck =
  | { ok: true; charged: boolean; status: EconomyStatus | null }
  | { ok: false; reason: 'no_credits' | 'theme_limit'; status: EconomyStatus };

/** Avant une recherche d'adversaire normale : thème autorisé ? crédit pris. Réseau en panne : on laisse jouer. */
export async function checkPlay(themeId: string): Promise<PlayCheck> {
  try {
    const res = await authFetch(`${API_URL}/api/economy/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme_id: themeId }),
    });
    const data = await res.json().catch(() => ({}));
    const s = pickStatus(data);
    if (s) publish(s);
    if ((res.status === 402 || res.status === 409) && s) {
      return { ok: false, reason: data.reason === 'theme_limit' ? 'theme_limit' : 'no_credits', status: s };
    }
    return { ok: true, charged: !!data.charged, status: s };
  } catch {
    return { ok: true, charged: false, status: current };
  }
}

/** Recherche abandonnée avant de trouver un adversaire : le serveur rend le crédit (une fois). */
export async function refundPlay(): Promise<void> {
  try {
    const res = await authFetch(`${API_URL}/api/economy/refund`, { method: 'POST' });
    const s = pickStatus(await res.json().catch(() => null));
    if (s) publish(s);
  } catch {}
}

async function post(path: string, body?: object): Promise<any | null> {
  try {
    const res = await authFetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const s = pickStatus(data);
    if (s) publish(s);
    return data;
  } catch {
    return null;
  }
}

/** À appeler APRÈS une pub vue jusqu'au bout. */
export const claimCreditsAd = () => post('/api/economy/credits/ad');
export const claimThemesAd = () => post('/api/economy/themes/ad');
export const openChest = (withAd: boolean) =>
  post('/api/economy/chest/open', { with_ad: withAd }) as Promise<({ reward: ChestReward } & EconomyStatus) | null>;

/** « 12 min », « 1 h 05 » jusqu'à `iso` (minimum 1 min). */
export function formatWait(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const mins = Math.max(1, Math.ceil((new Date(iso).getTime() - now) / 60000));
  if (mins < 60) return t('economy.minutes', { n: String(mins) });
  const h = Math.floor(mins / 60);
  return t('economy.hours', { h: String(h), m: String(mins % 60).padStart(2, '0') });
}
