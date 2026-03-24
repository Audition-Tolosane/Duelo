/**
 * Shared utility functions extracted from various screens.
 */
import { t } from './i18n';

const AVATAR_PALETTE = ['#FF6B35', '#8A2BE2', '#00D4FF', '#4CAF50', '#FF3B5C', '#FFB800', '#00FF9D', '#E53935'];

export function getInitial(pseudo: string): string {
  return pseudo && pseudo.length > 0 ? pseudo[0].toUpperCase() : '?';
}

export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('home.just_now');
  if (m < 60) return `${m}m`;
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h`;
  const d = Math.floor(diff / 86400000);
  return `${d}j`;
}
