import { getInitial, getAvatarColor, timeAgo } from '../utils/helpers';

describe('getInitial', () => {
  it('returns uppercase first letter of a pseudo', () => {
    expect(getInitial('alice')).toBe('A');
    expect(getInitial('Bob')).toBe('B');
  });

  it('returns "?" for empty string', () => {
    expect(getInitial('')).toBe('?');
  });

  it('returns "?" for falsy-like empty values', () => {
    expect(getInitial('')).toBe('?');
  });
});

describe('getAvatarColor', () => {
  it('returns a color string from the palette', () => {
    const palette = ['#FF6B35', '#8A2BE2', '#00D4FF', '#4CAF50', '#FF3B5C', '#FFB800', '#00FF9D', '#E53935'];
    const color = getAvatarColor('testuser');
    expect(palette).toContain(color);
  });

  it('returns consistent color for the same seed', () => {
    const color1 = getAvatarColor('alice');
    const color2 = getAvatarColor('alice');
    expect(color1).toBe(color2);
  });

  it('can return different colors for different seeds', () => {
    // With enough different seeds, at least two should differ
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(getAvatarColor));
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('timeAgo', () => {
  it('returns "A l\'instant" for dates less than 1 minute ago', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe("À l'instant");
  });

  it('returns minutes format for times < 60 minutes ago', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000).toISOString();
    expect(timeAgo(thirtyMinAgo)).toBe('30m');
  });

  it('returns hours format for times < 24 hours ago', () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 3600000).toISOString();
    expect(timeAgo(fiveHoursAgo)).toBe('5h');
  });

  it('returns days format for times >= 24 hours ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe('3j');
  });
});
