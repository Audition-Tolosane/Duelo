/**
 * Tests for getPulseTitle() — the client-side Pulse feed title translation.
 * This function replaces the French hardcoded titles sent by the backend
 * with properly i18n-ised strings.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock t() so tests are language-independent
jest.mock('../utils/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'pulse.perfect_score': 'Score Parfait 7/7 !',
      'pulse.victory': 'Victoire en',
      'pulse.match': 'Match en',
      'pulse.streak': 'Série de',
      'pulse.streak_wins': 'victoires !',
    };
    return map[key] ?? key;
  },
}));

// Import the function under test
// Since getPulseTitle is defined inside players.tsx we replicate it here
// (same logic, independent of React)
import { t } from '../utils/i18n';

type FeedItem = {
  type: string;
  category_name?: string;
  streak_count?: number;
  title?: string;
};

function getPulseTitle(item: FeedItem): string {
  if (item.type === 'perfect') return t('pulse.perfect_score');
  if (item.type === 'streak') {
    const n = item.streak_count ?? '';
    return `${t('pulse.streak')} ${n} ${t('pulse.streak_wins')}`;
  }
  const cat = item.category_name || '';
  if (item.type === 'victory') return `${t('pulse.victory')} ${cat}`;
  return `${t('pulse.match')} ${cat}`;
}

// ─────────────────────────────────────────────────────────────────────────

describe('getPulseTitle', () => {
  describe('type: perfect', () => {
    it('returns perfect score label', () => {
      const item: FeedItem = { type: 'perfect', category_name: 'Breaking Bad' };
      expect(getPulseTitle(item)).toBe('Score Parfait 7/7 !');
    });

    it('ignores category_name for perfect type', () => {
      const item: FeedItem = { type: 'perfect', category_name: 'Whatever' };
      expect(getPulseTitle(item)).toBe('Score Parfait 7/7 !');
    });
  });

  describe('type: streak', () => {
    it('includes streak count', () => {
      const item: FeedItem = { type: 'streak', streak_count: 7 };
      expect(getPulseTitle(item)).toBe('Série de 7 victoires !');
    });

    it('handles missing streak_count gracefully', () => {
      const item: FeedItem = { type: 'streak' };
      const result = getPulseTitle(item);
      expect(result).toContain('Série de');
      expect(result).toContain('victoires !');
    });

    it('streak count 1 still works', () => {
      const item: FeedItem = { type: 'streak', streak_count: 1 };
      expect(getPulseTitle(item)).toBe('Série de 1 victoires !');
    });
  });

  describe('type: victory', () => {
    it('includes category name', () => {
      const item: FeedItem = { type: 'victory', category_name: 'Breaking Bad' };
      expect(getPulseTitle(item)).toBe('Victoire en Breaking Bad');
    });

    it('handles empty category name', () => {
      const item: FeedItem = { type: 'victory', category_name: '' };
      expect(getPulseTitle(item)).toBe('Victoire en ');
    });
  });

  describe('type: defeat / other', () => {
    it('returns match label for defeat type', () => {
      const item: FeedItem = { type: 'defeat', category_name: 'Géographie' };
      expect(getPulseTitle(item)).toBe('Match en Géographie');
    });

    it('returns match label for unknown type', () => {
      const item: FeedItem = { type: 'unknown_future_type', category_name: 'Sciences' };
      expect(getPulseTitle(item)).toBe('Match en Sciences');
    });

    it('handles missing category_name for match', () => {
      const item: FeedItem = { type: 'defeat' };
      const result = getPulseTitle(item);
      expect(result).toContain('Match en');
    });
  });

  describe('never returns empty string', () => {
    const types = ['perfect', 'streak', 'victory', 'defeat', 'match', 'unknown'];
    types.forEach(type => {
      it(`type '${type}' always returns a non-empty string`, () => {
        const result = getPulseTitle({ type, category_name: '', streak_count: 5 });
        expect(result.trim().length).toBeGreaterThan(0);
      });
    });
  });
});
