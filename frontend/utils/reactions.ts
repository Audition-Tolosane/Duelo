import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from './i18n';

// Réactions entre joueurs (règles côté serveur : backend/services/reactions.py).
// Aucun texte libre : on n'envoie qu'une clé, chacun la lit dans sa langue.

export const REACTION_EMOJI: Record<string, string> = {
  laugh: '😂', fire: '🔥', shock: '😱', clap: '👏', handshake: '🤝',
  crown: '👑', skull: '💀', angry: '😤', mindblown: '🤯',
};

/** Pendant un duel en direct : 4 émojis, un par question. */
export const DUEL_REACTIONS = ['laugh', 'fire', 'shock', 'clap'];

/** Après un match : gratuites pour tous. */
export const FREE_EMOJIS = ['laugh', 'fire', 'shock', 'clap', 'handshake'];
export const FREE_PHRASES = ['gg', 'well_played', 'rematch', 'got_me', 'lucky', 'oops', 'next_time'];
/** À débloquer dans le coffre du jour. */
export const LOCKED_EMOJIS = ['crown', 'skull', 'angry', 'mindblown'];
export const LOCKED_PHRASES = ['too_easy', 'no_fear', 'lessons', 'unstoppable'];

export const isEmojiReaction = (key: string) => key in REACTION_EMOJI;

/** Texte affiché pour une clé : l'émoji, ou la phrase traduite. Clé inconnue → telle quelle. */
export function reactionLabel(key: string): string {
  if (REACTION_EMOJI[key]) return REACTION_EMOJI[key];
  const k = `reaction.${key}`;
  const s = t(k);
  return s === k ? key : s;
}

// Réglage « afficher les réactions des adversaires » (par appareil).
const MUTE_KEY = 'duelo_reactions_muted';
let mutedCache: boolean | null = null;

export async function getReactionsMuted(): Promise<boolean> {
  if (mutedCache !== null) return mutedCache;
  try { mutedCache = (await AsyncStorage.getItem(MUTE_KEY)) === '1'; } catch { mutedCache = false; }
  return mutedCache;
}

export async function setReactionsMuted(muted: boolean): Promise<void> {
  mutedCache = muted;
  try { await AsyncStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
}

/** Réaction d'un bot : rare, cohérente avec la question qui vient de se jouer. */
export function botReactionFor(botCorrect: boolean, playerCorrect: boolean): string | null {
  if (Math.random() > 0.3) return null;
  if (botCorrect && !playerCorrect) return Math.random() < 0.5 ? 'laugh' : 'fire';
  if (!botCorrect && playerCorrect) return Math.random() < 0.5 ? 'shock' : 'clap';
  if (botCorrect && playerCorrect) return Math.random() < 0.5 ? 'fire' : 'clap';
  return Math.random() < 0.5 ? 'shock' : null;
}

/** Réponse d'un bot à une réaction reçue (après le match ou en duel). */
export function botReplyTo(key: string, botWon: boolean): string | null {
  if (Math.random() > 0.55) return null;
  if (key === 'rematch') return 'next_time';
  if (key === 'gg' || key === 'well_played' || key === 'handshake' || key === 'clap') return Math.random() < 0.5 ? 'gg' : 'handshake';
  if (key === 'laugh' || key === 'lucky' || key === 'oops') return 'laugh';
  return botWon ? 'next_time' : 'well_played';
}
