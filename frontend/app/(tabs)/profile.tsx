import React, { useState, useEffect, useId } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert, TextInput, Pressable } from 'react-native';
import { useRouter, Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import UserAvatar from '../../components/UserAvatar';
import { authFetch } from '../../utils/api';
import { useTabBar } from '../../contexts/TabBarContext';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinear, RadialGradient, Stop, Rect } from 'react-native-svg';
import { t, getLocale, getLanguage } from '../../utils/i18n';
import {
  Txt, Icon, IconName, Button, IconButton, Section, ProgressBar, ListRow, Loader, Dialog,
  BottomSheet, ThemeIcon, EmptyState, SatinSurface, AmbientBackdrop, HeroGlow,
} from '../../components/ui';
import { COLOR, PALETTE, SPACE, RADII, SIZE, BORDER, ICON_SIZE, TYPO, alpha } from '../../theme/tokens';

// Profil SKILKI : hero → rang puis niveau (une carte) → victoires et stats → abonnés → succès et titres
// → thèmes → historique.
// Parrainage, réglages, déconnexion et suppression de compte vivent dans /settings.
// `as Href` sur /settings et /theme-list : routes absentes des types générés jusqu'au prochain `expo start`.

// ── XP/Level helpers ──
function xpForNextLevel(level: number) { return 500 + Math.pow(level - 1, 2) * 10; }
function getXpLevel(xp: number) {
  if (xp <= 0) return 0;
  let level = 1, cum = 0;
  while (level < 50) { const n = xpForNextLevel(level); if (cum + n > xp) break; cum += n; level++; }
  return level;
}
function getXpInLevel(xp: number, level: number) {
  let cum = 0;
  for (let l = 1; l < (level || 1); l++) cum += xpForNextLevel(l);
  const needed = xpForNextLevel(level || 1);
  const current = Math.max(0, xp - cum);
  return { current, needed, progress: Math.min(current / Math.max(needed, 1), 1) };
}

// Palier ultime de la ligue : seul rang en violet (rareté). Tous les autres sont en or.
const ULTIMATE_TIER = 'diamond';

const COUNTRIES: { name: string; flag: string }[] = [
  { name: 'France', flag: '🇫🇷' }, { name: 'Germany', flag: '🇩🇪' }, { name: 'Spain', flag: '🇪🇸' },
  { name: 'Italy', flag: '🇮🇹' }, { name: 'United Kingdom', flag: '🇬🇧' }, { name: 'United States', flag: '🇺🇸' },
  { name: 'Canada', flag: '🇨🇦' }, { name: 'Brazil', flag: '🇧🇷' }, { name: 'Japan', flag: '🇯🇵' },
  { name: 'China', flag: '🇨🇳' }, { name: 'Australia', flag: '🇦🇺' }, { name: 'India', flag: '🇮🇳' },
  { name: 'Mexico', flag: '🇲🇽' }, { name: 'Russia', flag: '🇷🇺' }, { name: 'South Korea', flag: '🇰🇷' },
  { name: 'Netherlands', flag: '🇳🇱' }, { name: 'Belgium', flag: '🇧🇪' }, { name: 'Switzerland', flag: '🇨🇭' },
  { name: 'Portugal', flag: '🇵🇹' }, { name: 'Sweden', flag: '🇸🇪' }, { name: 'Norway', flag: '🇳🇴' },
  { name: 'Denmark', flag: '🇩🇰' }, { name: 'Finland', flag: '🇫🇮' }, { name: 'Poland', flag: '🇵🇱' },
  { name: 'Austria', flag: '🇦🇹' }, { name: 'Ireland', flag: '🇮🇪' }, { name: 'Argentina', flag: '🇦🇷' },
  { name: 'Colombia', flag: '🇨🇴' }, { name: 'Chile', flag: '🇨🇱' }, { name: 'Morocco', flag: '🇲🇦' },
  { name: 'Algeria', flag: '🇩🇿' }, { name: 'Tunisia', flag: '🇹🇳' }, { name: 'Egypt', flag: '🇪🇬' },
  { name: 'Turkey', flag: '🇹🇷' }, { name: 'Saudi Arabia', flag: '🇸🇦' }, { name: 'South Africa', flag: '🇿🇦' },
  { name: 'Nigeria', flag: '🇳🇬' }, { name: 'Indonesia', flag: '🇮🇩' }, { name: 'Thailand', flag: '🇹🇭' },
  { name: 'Vietnam', flag: '🇻🇳' }, { name: 'Philippines', flag: '🇵🇭' }, { name: 'Malaysia', flag: '🇲🇾' },
  { name: 'Singapore', flag: '🇸🇬' }, { name: 'New Zealand', flag: '🇳🇿' }, { name: 'Israel', flag: '🇮🇱' },
  { name: 'Greece', flag: '🇬🇷' }, { name: 'Czech Republic', flag: '🇨🇿' }, { name: 'Romania', flag: '🇷🇴' },
  { name: 'Hungary', flag: '🇭🇺' }, { name: 'Ukraine', flag: '🇺🇦' }, { name: 'Croatia', flag: '🇭🇷' },
  { name: 'Peru', flag: '🇵🇪' }, { name: 'Venezuela', flag: '🇻🇪' }, { name: 'Ecuador', flag: '🇪🇨' },
];

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const THEMES_SHOWN = 5;
const HISTORY_SHOWN = 5;
const ACH_SHOWN = 8;
const MEDAL_W = 52; // écusson de succès

// ── Succès : pictogrammes Lucide du registre (au plus proche de l'ancien glyphe) ──
const ACH_ICONS: Record<string, IconName> = {
  first_game: 'gamepad',
  games_10: 'target',
  games_50: 'duel',
  games_100: 'medal',
  win_first: 'trophy',
  wins_10: 'trophy',
  wins_50: 'crown',
  wins_100: 'crown',
  streak_3: 'flame',
  streak_7: 'bolt',
  streak_15: 'sparkles',
  streak_30: 'flame',
  perfect_1: 'star',
  perfect_5: 'star',
  perfect_20: 'sparkles',
  perfect_50: 'sparkles',
  login_7: 'calendar',
  login_30: 'calendar',
  login_60: 'calendar',
  challenge_first: 'duel',
  challenges_10: 'shield',
  themes_3: 'compass',
  themes_10: 'globe',
  daily_q_7: 'brain',
  daily_q_30: 'book',
  missions_7: 'check',
  missions_30: 'medal',
};

// Rare = succès cosmétique (cadre) ou palier ≥ 1000 XP : seul cas où le violet apparaît.
const isRareAch = (a: any) => !!a?.frame || (a?.xp ?? 0) >= 1000;

// Grands nombres lisibles (12 345) selon la langue de l'app.
const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString(getLocale());

function Divider() {
  return <View style={s.divider} />;
}

// ── Écusson commun (rangs et succès) : forme vectorielle simple, viewBox 48×52 ──
const CREST_W = 48;
const CREST_H = 52;
const CREST_PATH = 'M24 2 L44 8.5 V25 C44 37.5 35.5 46.5 24 50 C12.5 46.5 4 37.5 4 25 V8.5 Z';
// Cœur de l'écusson : même forme réduite autour de son centre (liseré métal de ~4 px)
const CREST_INSET = 'translate(24 26) scale(0.78) translate(-24 -26)';

function Crest({ width, fill, tint, stroke, children }: {
  width: number; fill: string; tint?: string; stroke?: string; children?: React.ReactNode;
}) {
  const height = (width * CREST_H) / CREST_W;
  // Trait constant à l'écran, quelle que soit la taille de l'écusson
  const strokeWidth = (BORDER.default * CREST_W) / width;
  return (
    <View style={[s.crestBox, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${CREST_W} ${CREST_H}`} style={StyleSheet.absoluteFill}>
        <Path d={CREST_PATH} fill={fill} />
        {tint ? <Path d={CREST_PATH} fill={tint} /> : null}
        {stroke ? <Path d={CREST_PATH} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" /> : null}
      </Svg>
      <View style={s.crestIcon}>{children}</View>
    </View>
  );
}

// Identifiant SVG unique (plusieurs écussons par écran ; le web partage un seul espace d'ids)
function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

// Lueur douce derrière un élément (écusson obtenu) : diffuse, jamais un néon
function SoftGlow({ size, color, strength }: { size: number; color: string; strength: number }) {
  const id = useSvgId('glow');
  return (
    <View pointerEvents="none" style={[s.glow, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={strength} />
            <Stop offset="0.55" stopColor={color} stopOpacity={strength * 0.3} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

// ── Écusson métal : or satiné (violet au palier ultime / succès rare).
//    `inset` = cœur pétrole sombre et pictogramme or (succès) ; sinon métal plein, pictogramme nuit (rang).
function MetalCrest({ width, hue, inset, children }: {
  width: number; hue: string; inset?: boolean; children?: React.ReactNode;
}) {
  const id = useSvgId('crest');
  const height = (width * CREST_H) / CREST_W;
  return (
    <View style={[s.crestBox, { width, height }]}>
      <SoftGlow size={width * 1.9} color={hue} strength={0.3} />
      <Svg width={width} height={height} viewBox={`0 0 ${CREST_W} ${CREST_H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Métal : teinte pleine en haut, plus sourde en bas (une seule teinte) */}
          <SvgLinear id={`${id}m`} x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={hue} stopOpacity={1} />
            <Stop offset="1" stopColor={hue} stopOpacity={0.62} />
          </SvgLinear>
          {/* Reflet satiné en haut à gauche */}
          <SvgLinear id={`${id}h`} x1="0" y1="0" x2="0.8" y2="0.7">
            <Stop offset="0" stopColor={PALETTE.cream} stopOpacity={0.45} />
            <Stop offset="0.45" stopColor={PALETTE.cream} stopOpacity={0.06} />
            <Stop offset="1" stopColor={PALETTE.cream} stopOpacity={0} />
          </SvgLinear>
          <SvgLinear id={`${id}i`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={PALETTE.petrol} stopOpacity={1} />
            <Stop offset="1" stopColor={PALETTE.night} stopOpacity={1} />
          </SvgLinear>
        </Defs>
        <Path d={CREST_PATH} fill={PALETTE.night} />
        <Path d={CREST_PATH} fill={`url(#${id}m)`} />
        <Path d={CREST_PATH} fill={`url(#${id}h)`} />
        {inset ? (
          <Path d={CREST_PATH} transform={CREST_INSET} fill={`url(#${id}i)`} stroke={hue} strokeOpacity={0.5} strokeWidth={0.8} />
        ) : null}
      </Svg>
      <View style={s.crestIcon}>{children}</View>
    </View>
  );
}

// ── Écusson de ligue : métal or (violet au palier ultime), pictogramme nuit ──
function LeagueCrest({ tier }: { tier: string }) {
  const ultimate = tier === ULTIMATE_TIER;
  return (
    <MetalCrest width={SIZE.touch + SPACE.sm} hue={ultimate ? PALETTE.violet : PALETTE.gold}>
      <Icon name={ultimate ? 'crown' : 'shield'} size={ICON_SIZE.lg} color={COLOR.text.onAction} />
    </MetalCrest>
  );
}

// ── Médaillon de succès : pétrole plein ; obtenu = or (liseré + teinte), rare obtenu = violet,
//    verrouillé = crème 40 % sur pétrole profond, avec barre fine si la progression a commencé ──
function AchievementMedal({ item, width }: { item: any; width: number }) {
  const done = !!item.unlocked;
  const rare = done && isRareAch(item);
  const accent = rare ? COLOR.accent.rare : COLOR.reward.gold;
  const pct = done ? 1 : Math.min(1, (item.progress || 0) / (item.target || 1));
  return (
    <View style={s.medalWrap}>
      {done ? (
        <MetalCrest width={width} hue={rare ? PALETTE.violet : PALETTE.gold} inset>
          <Icon name={ACH_ICONS[item.id] ?? 'star'} size={ICON_SIZE.md} color={accent} />
        </MetalCrest>
      ) : (
        <View>
          <Crest width={width} fill={COLOR.bg.primary} stroke={COLOR.border.default}>
            <Icon name={ACH_ICONS[item.id] ?? 'star'} size={ICON_SIZE.md} color={COLOR.text.disabled} />
          </Crest>
          {/* Verrouillé : petit cadenas, la forme reste lisible mais éteinte */}
          <View style={s.medalLock}>
            <Icon name="lock" size={12} color={COLOR.text.tertiary} />
          </View>
        </View>
      )}
      {!done && pct > 0 ? (
        <View style={[s.medalTrack, { width: width - SPACE.md }]}>
          <View style={[s.medalFill, { width: `${pct * 100}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

// ── Anneau du taux de victoire (lecture rapide) : piste crème 12 %, arc jaune = moi ──
const RING = 84;
const RING_STROKE = 9;
function WinRing({ value }: { value: number }) {
  const r = (RING - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <Svg width={RING} height={RING} aria-hidden>
      <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={COLOR.track} strokeWidth={RING_STROKE} fill="none" />
      {v > 0 ? (
        <Circle
          cx={RING / 2} cy={RING / 2} r={r}
          stroke={COLOR.player.self} strokeWidth={RING_STROKE} fill="none" strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      ) : null}
    </Svg>
  );
}

// ── Cellule de stat (Série, Record) : pictogramme, libellé, chiffre tabulaire qui rétrécit ──
function StatCell({ value, label, icon, color }: { value: string; label: string; icon: IconName; color: string }) {
  return (
    <View style={s.statCell} accessible accessibilityLabel={`${label} ${value}`}>
      <Icon name={icon} size={ICON_SIZE.lg} color={color} />
      <View style={s.shrink}>
        <Txt variant="overline" numberOfLines={1}>{label}</Txt>
        <Txt variant="statMedium" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Txt>
      </View>
    </View>
  );
}

// ── Succès & titres : grille sobre (or = obtenu, crème 40 % = verrouillé, violet = rare) ──
function AchievementsSection({ userId, footer }: { userId: string; footer?: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<any[]>([]);
  const [inProgress, setInProgress] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedAch, setSelectedAch] = useState<any | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!userId) return;
    authFetch(`${API_URL}/api/achievements/mine`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setUnlocked(d.unlocked || []);
          setInProgress(d.in_progress || []);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [userId]);

  if (!loaded) return null;

  const all = [...unlocked, ...inProgress];
  const shown = all.slice(0, ACH_SHOWN);

  const renderCell = (item: any, onPress: () => void) => {
    const done = item.unlocked;
    return (
      <Pressable
        key={item.id}
        style={({ pressed }) => [s.achCell, pressed && s.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={done ? item.name : `${item.name}, ${item.progress || 0} / ${item.target}`}
      >
        <AchievementMedal item={item} width={MEDAL_W} />
        <Txt variant="caption" color={done ? COLOR.text.primary : COLOR.text.tertiary} align="center" numberOfLines={2}>
          {item.name}
        </Txt>
        {!done ? (
          <Txt variant="caption" color={COLOR.text.disabled} style={s.tabular} numberOfLines={1}>
            {`${fmt(item.progress)}/${fmt(item.target)}`}
          </Txt>
        ) : null}
      </Pressable>
    );
  };

  const sel = selectedAch;
  const selDone = !!sel?.unlocked;
  const selRare = isRareAch(sel);
  const selPct = sel ? (selDone ? 1 : Math.min(1, (sel.progress || 0) / (sel.target || 1))) : 0;

  return (
    <Section
      title={t('pilot.profile.achievements_title')}
      overline={t('pilot.profile.ach_count', { n: String(unlocked.length), total: String(all.length) })}
      onSeeAll={all.length > ACH_SHOWN ? () => setShowAll(true) : undefined}
    >
      <SatinSurface variant="card" contentStyle={s.achCard}>
        {shown.length > 0 ? (
          <View style={s.achGrid}>{shown.map(item => renderCell(item, () => setSelectedAch(item)))}</View>
        ) : null}
        {shown.length > 0 && footer ? <Divider /> : null}
        {footer}
      </SatinSurface>

      {/* Tous les succès */}
      <BottomSheet visible={showAll} onClose={() => setShowAll(false)} title={t('pilot.profile.achievements_title')}>
        <View style={s.achGrid}>
          {all.map(item => renderCell(item, () => { setShowAll(false); setSelectedAch(item); }))}
        </View>
      </BottomSheet>

      {/* Détail d'un succès */}
      <Dialog
        visible={!!sel}
        onClose={() => setSelectedAch(null)}
        icon={sel ? (ACH_ICONS[sel.id] ?? 'star') : undefined}
        tone={!selDone ? 'neutral' : selRare ? 'rare' : 'reward'}
        title={sel?.name}
        message={sel?.desc}
        actions={<Button label={t('common.close')} variant="ghost" onPress={() => setSelectedAch(null)} fullWidth />}
      >
        {sel ? (
          <View style={s.achDetail}>
            <ProgressBar value={selPct} tone="reward" />
            <Txt variant="label" align="center" color={selDone ? (selRare ? COLOR.accent.rare : COLOR.reward.gold) : COLOR.text.secondary} style={s.tabular}>
              {selDone
                ? (sel.unlocked_at
                  ? t('pilot.profile.ach_unlocked_on', { date: new Date(sel.unlocked_at).toLocaleDateString('fr-FR') })
                  : t('pilot.profile.ach_unlocked'))
                : `${fmt(sel.progress)} / ${fmt(sel.target)}`}
            </Txt>
            {!selDone ? (
              <Txt variant="caption" align="center" color={COLOR.reward.gold}>
                {t('pilot.profile.ach_reward', { xp: fmt(sel.xp) })}
              </Txt>
            ) : null}
          </View>
        ) : null}
      </Dialog>
    </Section>
  );
}

type ThemeData = {
  id: string;
  name: string;
  super_category: string;
  cluster: string;
  color_hex: string;
  icon_url: string;
  xp: number;
  level: number;
  title: string;
  xp_progress: { current: number; needed: number; progress: number };
};

type UnlockedTitle = {
  level: number;
  title: string;
  theme_id: string;
  theme_name: string;
};

type ProfileData = {
  user: {
    id: string; pseudo: string; avatar_seed: string; avatar_url?: string | null; is_guest: boolean;
    total_xp: number; selected_title: string | null;
    country: string | null; city: string | null; country_flag: string;
    matches_played: number; matches_won: number;
    best_streak: number; current_streak: number; streak_badge: string;
    login_streak: number; best_login_streak: number;
    win_rate: number;
    followers_count: number; following_count: number;
  };
  themes: ThemeData[];
  all_unlocked_titles: UnlockedTitle[];
  match_history: Array<{
    id: string; category: string; player_score: number; opponent_score: number;
    opponent: string; opponent_id?: string | null; is_bot?: boolean; won: boolean; xp_earned: number;
    xp_breakdown: any; correct_count: number; created_at: string;
  }>;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { onScroll: onTabScroll } = useTabBar();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [presetAvatars, setPresetAvatars] = useState<{id: string; name: string; image_url: string; category: string}[]>([]);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationCity, setLocationCity] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [leagueData, setLeagueData] = useState<{
    mmr: number; tier: string; tier_label: string; tier_color: string;
    tier_progress: number; global_rank: number; season: { name: string };
    next_tier_label: string | null; next_tier_mmr: number | null;
  } | null>(null);

  useEffect(() => { loadProfile(); loadLeague(); }, []);

  const loadLeague = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/league/status`);
      if (res.ok) setLeagueData(await res.json());
    } catch {}
  };

  const loadProfile = async () => {
    setProfileError(false);
    const userId = await AsyncStorage.getItem('duelo_user_id');
    const pseudo = await AsyncStorage.getItem('duelo_pseudo');
    const avatarSeed = await AsyncStorage.getItem('duelo_avatar_seed');
    if (!userId) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_URL}/api/profile-v2/${userId}?pseudo=${encodeURIComponent(pseudo || '')}&lang=${getLanguage()}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        // API failed but user is logged in - show basic profile from local storage
        setProfileError(true);
        setProfile({
          user: {
            id: userId, pseudo: pseudo || t('profile.player_default'), avatar_seed: avatarSeed || '',
            is_guest: true, total_xp: 0, selected_title: null,
            country: null, city: null, country_flag: '',
            matches_played: 0, matches_won: 0,
            best_streak: 0, current_streak: 0, streak_badge: '', login_streak: 0, best_login_streak: 0,
            win_rate: 0, followers_count: 0, following_count: 0,
          },
          themes: [], all_unlocked_titles: [], match_history: [],
        });
      }
    } catch {
      // Network error - show basic profile from local storage
      setProfileError(true);
      setProfile({
        user: {
          id: userId, pseudo: pseudo || t('profile.player_default'), avatar_seed: avatarSeed || '',
          is_guest: true, total_xp: 0, selected_title: null,
          country: null, city: null, country_flag: '',
          matches_played: 0, matches_won: 0,
          best_streak: 0, current_streak: 0, streak_badge: '',
          login_streak: 0, best_login_streak: 0,
          win_rate: 0, followers_count: 0, following_count: 0,
        },
        themes: [], all_unlocked_titles: [], match_history: [],
      });
    }
    setLoading(false);
  };

  const handleSelectTitle = async (title: string) => {
    if (!profile) return;
    const previousTitle = profile.user.selected_title;
    setSavingTitle(true);
    // Optimistic update
    setProfile(prev => prev ? { ...prev, user: { ...prev.user, selected_title: title } } : null);
    try {
      const res = await authFetch(`${API_URL}/api/user/select-title`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile?.user?.id, title }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // Rollback on failure
        setProfile(prev => prev ? { ...prev, user: { ...prev.user, selected_title: previousTitle } } : null);
        Alert.alert(t('common.error'), t('profile.error_change_title'));
      }
    } catch {
      // Rollback on network error
      setProfile(prev => prev ? { ...prev, user: { ...prev.user, selected_title: previousTitle } } : null);
      Alert.alert(t('common.error'), t('profile.error_network'));
    }
    setSavingTitle(false);
    setShowTitleModal(false);
  };

  const openLocationModal = () => {
    setLocationCity(profile?.user?.city || '');
    setLocationCountry(profile?.user?.country || '');
    setCountrySearch('');
    setShowCountryDropdown(false);
    setShowLocationModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveLocation = async () => {
    if (!profile) return;
    setSavingLocation(true);
    try {
      const res = await authFetch(`${API_URL}/api/user/location`, {
        method: 'PATCH',
        body: JSON.stringify({ city: locationCity, country: locationCountry }),
      });
      const data = await res.json();
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setProfile(prev => prev ? {
          ...prev,
          user: { ...prev.user, city: data.city, country: data.country, country_flag: data.country_flag || '' }
        } : null);
        setShowLocationModal(false);
      } else {
        Alert.alert(t('common.error'), t('profile.error_network'));
      }
    } catch {
      Alert.alert(t('common.error'), t('profile.error_network'));
    }
    setSavingLocation(false);
  };

  const openAvatarModal = async () => {
    setShowAvatarModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await fetch(`${API_URL}/api/admin/avatars`);
      const data = await res.json();
      setPresetAvatars(data.avatars || []);
    } catch (e) { console.error(e); }
  };

  const handleSelectAvatar = async (avatarId: string) => {
    if (!profile) return;
    const previousAvatarUrl = profile.user.avatar_url;
    setSavingAvatar(true);
    try {
      const res = await authFetch(`${API_URL}/api/user/select-avatar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.user.id, avatar_id: avatarId }),
      });
      const data = await res.json();
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setProfile(prev => prev ? { ...prev, user: { ...prev.user, avatar_url: data.avatar_url } } : null);
        await AsyncStorage.setItem('duelo_avatar_url', data.avatar_url);
        setShowAvatarModal(false);
      } else {
        // Rollback on failure
        setProfile(prev => prev ? { ...prev, user: { ...prev.user, avatar_url: previousAvatarUrl } } : null);
        Alert.alert(t('common.error'), t('profile.error_change_avatar'));
      }
    } catch {
      // Rollback on network error
      setProfile(prev => prev ? { ...prev, user: { ...prev.user, avatar_url: previousAvatarUrl } } : null);
      Alert.alert(t('common.error'), t('profile.error_network'));
    }
    setSavingAvatar(false);
  };

  const handleUploadPhoto = async () => {
    if (!profile) return;
    const previousAvatarUrl = profile.user.avatar_url;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true, quality: 0.8, allowsEditing: true, aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    setSavingAvatar(true);
    try {
      const res = await authFetch(`${API_URL}/api/user/upload-avatar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.user.id, image_base64: result.assets[0].base64 }),
      });
      const data = await res.json();
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const urlWithCache = `${data.avatar_url}?t=${Date.now()}`;
        setProfile(prev => prev ? { ...prev, user: { ...prev.user, avatar_url: urlWithCache } } : null);
        await AsyncStorage.setItem('duelo_avatar_url', urlWithCache);
        setShowAvatarModal(false);
      } else {
        // Rollback on failure
        setProfile(prev => prev ? { ...prev, user: { ...prev.user, avatar_url: previousAvatarUrl } } : null);
        Alert.alert(t('common.error'), t('profile.error_upload_avatar'));
      }
    } catch {
      // Rollback on network error
      setProfile(prev => prev ? { ...prev, user: { ...prev.user, avatar_url: previousAvatarUrl } } : null);
      Alert.alert(t('common.error'), t('profile.error_network'));
    }
    setSavingAvatar(false);
  };

  if (loading) {
    return <View style={s.container}><Loader fill /></View>;
  }
  if (!profile || !profile.user) {
    return (
      <View style={[s.container, s.centered]}>
        <EmptyState
          icon="user"
          title={t('profile.login_prompt')}
          actionLabel={t('profile.login_button')}
          onAction={() => router.replace('/')}
        />
      </View>
    );
  }

  const { user, themes, all_unlocked_titles, match_history } = profile;
  const displayTitle = user?.selected_title || (all_unlocked_titles && all_unlocked_titles.length > 0 ? all_unlocked_titles[0]?.title : '') || '';

  const lvl = getXpLevel(user.total_xp || 0);
  const { current, needed, progress } = getXpInLevel(user.total_xp || 0, lvl);
  const favThemes = [...(themes || [])].sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const history = match_history || [];
  const historyShown = historyExpanded ? history : history.slice(0, HISTORY_SHOWN);
  const ultimate = leagueData?.tier === ULTIMATE_TIER;
  const leagueTone = ultimate ? COLOR.accent.rare : COLOR.reward.gold;
  const winRate = Math.max(0, Math.min(100, Math.round(user?.win_rate || 0)));
  const countryFlag = (name: string) => COUNTRIES.find(c => c.name === name)?.flag;

  return (
    <View style={s.container}>
      <AmbientBackdrop />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} onScroll={onTabScroll} scrollEventThrottle={16}>

        {profileError && (
          <SatinSurface variant="card" warm="none" onPress={() => { setProfileError(false); setLoading(true); loadProfile(); }} style={s.errorCard} contentStyle={s.cardPad}>
            <View style={s.inline}>
              <Icon name="error" size={ICON_SIZE.md} color={COLOR.status.error} />
              <Txt variant="bodySmall" color={COLOR.status.error} style={s.flex}>{t('profile.offline_error')}</Txt>
              <Icon name="replay" size={ICON_SIZE.sm} color={COLOR.status.error} />
            </View>
          </SatinSurface>
        )}

        {/* ── Hero : avatar, pseudo, titre (or), lieu, engrenage ── */}
        <View style={s.hero}>
          <HeroGlow height={HERO_GLOW} />
          <IconButton
            icon="settings"
            accessibilityLabel={t('pilot.settings.title')}
            onPress={() => router.push(`/settings?guest=${user?.is_guest ? '1' : '0'}` as Href)}
            testID="profile-settings"
            style={s.gear}
          />
          <Pressable
            onPress={openAvatarModal}
            accessibilityRole="button"
            accessibilityLabel={t('profile.change_avatar')}
            style={({ pressed }) => [s.avatarWrap, pressed && s.pressed]}
          >
            <UserAvatar
              avatarUrl={user?.avatar_url}
              avatarSeed={user?.avatar_seed}
              pseudo={user?.pseudo}
              size={96}
              borderColor={COLOR.player.self}
              borderWidth={BORDER.strong}
            />
            <View style={s.avatarEdit}>
              <Icon name="plus" size={ICON_SIZE.sm} color={COLOR.text.onAction} />
            </View>
          </Pressable>

          <Txt variant="h1" align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={s.heroName}>
            {user?.pseudo || t('profile.player_default')}
          </Txt>

          <Pressable
            onPress={() => setShowTitleModal(true)}
            accessibilityRole="button"
            accessibilityLabel={t('profile.change_title')}
            hitSlop={HERO_SLOP}
            style={({ pressed }) => [s.heroLink, pressed && s.pressed]}
          >
            <Icon name="crown" size={ICON_SIZE.sm} color={displayTitle ? COLOR.reward.gold : COLOR.text.tertiary} />
            <Txt variant="label" color={displayTitle ? COLOR.reward.gold : COLOR.text.tertiary} numberOfLines={1} style={s.shrink}>
              {displayTitle || t('profile.no_title')}
            </Txt>
            <Icon name="chevronDown" size={ICON_SIZE.sm} color={COLOR.text.tertiary} />
          </Pressable>

          <Pressable
            onPress={openLocationModal}
            accessibilityRole="button"
            accessibilityLabel={t('profile.edit_location')}
            hitSlop={HERO_SLOP}
            style={({ pressed }) => [s.heroLink, pressed && s.pressed]}
          >
            {user?.country_flag
              ? <Txt variant="label">{user.country_flag}</Txt>
              : <Icon name="globe" size={ICON_SIZE.sm} color={COLOR.text.secondary} />}
            <Txt variant="label" numberOfLines={1} style={s.shrink}>
              {user?.city && user?.country
                ? `${user.city}, ${user.country}`
                : user?.country || t('profile.world')}
            </Txt>
            <Icon name="chevronDown" size={ICON_SIZE.sm} color={COLOR.text.tertiary} />
          </Pressable>

          {/* ── Abonnés · abonnements : une ligne sous l'identité ── */}
          <View style={s.socialRow}>
            <Pressable
              onPress={() => router.push(`/followers?userId=${profile?.user.id}&type=followers`)}
              accessibilityRole="button"
              hitSlop={HERO_SLOP}
              style={({ pressed }) => [s.socialItem, pressed && s.pressed]}
            >
              <Txt variant="bodySmall" color={COLOR.text.secondary} style={s.tabular}>
                <Txt variant="bodySmall" color={COLOR.text.primary}>{fmt(user?.followers_count)}</Txt>
                {` ${t('profile.followers_label').toLocaleLowerCase(getLocale())}`}
              </Txt>
            </Pressable>
            <View style={s.socialDot} />
            <Pressable
              onPress={() => router.push(`/followers?userId=${profile?.user.id}&type=following`)}
              accessibilityRole="button"
              hitSlop={HERO_SLOP}
              style={({ pressed }) => [s.socialItem, pressed && s.pressed]}
            >
              <Txt variant="bodySmall" color={COLOR.text.secondary} style={s.tabular}>
                <Txt variant="bodySmall" color={COLOR.text.primary}>{fmt(user?.following_count)}</Txt>
                {` ${t('profile.following_label').toLocaleLowerCase(getLocale())}`}
              </Txt>
            </Pressable>
          </View>
        </View>

        <View style={s.body}>
          {/* ── Rang (prestige, en tête) puis niveau et progression — une seule carte ── */}
          {/* Rang + niveau et victoires : deux cartes sœurs, plus serrées que les sections */}
          <View style={s.cardsBlock}>
          <SatinSurface variant="card" warm="gold" contentStyle={[s.cardPad, s.progressCard]}>
            {leagueData && (
              <>
                <View style={s.leagueRow}>
                  <LeagueCrest tier={leagueData.tier} />
                  <View style={s.flex}>
                    <Txt variant="h3" color={leagueTone} numberOfLines={1}>{leagueData.tier_label}</Txt>
                    <Txt variant="caption" numberOfLines={1} style={s.tabular}>
                      {`${leagueData.season.name} · ${t('pilot.profile.global_rank', { rank: fmt(leagueData.global_rank) })}`}
                    </Txt>
                  </View>
                  <View style={s.alignEnd}>
                    <Txt variant="statMedium" numberOfLines={1}>{fmt(leagueData.mmr)}</Txt>
                    <Txt variant="overline" align="right" numberOfLines={2} style={s.pointsLabel}>{t('pilot.league.ranking_points')}</Txt>
                  </View>
                </View>
                <ProgressBar value={leagueData.tier_progress} tone="reward" height={6} />
              </>
            )}

            {/* Séparateur porté par la ligne niveau : un seul écart de 12 entre les blocs (V1.2) */}
            <View style={[s.levelRow, leagueData && s.levelRowSeparated]}>
              <View>
                <Txt variant="overline">{t('pilot.profile.level')}</Txt>
                <Txt variant="statLarge">{lvl}</Txt>
              </View>
              <View style={[s.alignEnd, s.shrink]}>
                <Txt variant="label" color={COLOR.reward.gold} style={s.tabular} numberOfLines={1}>
                  {`${fmt(user.total_xp)} XP`}
                </Txt>
                <Txt variant="caption" numberOfLines={1}>{t('profile.total_xp')}</Txt>
              </View>
            </View>
            <ProgressBar value={progress} tone="action" sheen />
            <View style={s.spread}>
              <Txt variant="caption" style={s.tabular}>{`${fmt(current)} / ${fmt(needed)} XP`}</Txt>
              <Txt variant="caption" color={COLOR.text.secondary}>{`${t('profile.level_short')} ${Math.min(lvl + 1, 50)}`}</Txt>
            </View>
          </SatinSurface>

          {/* ── Victoires : % en lecture rapide + nombre brut, anneau à droite ; Série | Record dessous ── */}
          <SatinSurface variant="card" contentStyle={[s.cardPad, s.statsCard]}>
            <View style={s.winRow}>
              <View style={s.flex}>
                <Txt variant="overline" numberOfLines={1}>{t('pilot.profile.win_rate_title')}</Txt>
                <Txt variant="statLarge" numberOfLines={1}>{`${winRate}%`}</Txt>
                <Txt variant="caption" numberOfLines={2} style={s.tabular}>
                  {t('pilot.profile.win_summary', { wins: fmt(user?.matches_won), played: fmt(user?.matches_played) })}
                </Txt>
              </View>
              <WinRing value={winRate / 100} />
            </View>
            <Divider />
            <View style={s.statRow}>
              <StatCell value={fmt(user?.current_streak)} label={t('pilot.profile.stat_streak')} icon="flame" color={COLOR.accent.warm} />
              <View style={s.statSep} />
              <StatCell value={fmt(user?.best_streak)} label={t('pilot.profile.stat_best')} icon="trophy" color={COLOR.reward.gold} />
            </View>
          </SatinSurface>
          </View>

          {/* ── Succès & titres ── */}
          <AchievementsSection
            userId={user?.id || ''}
            footer={
              <ListRow
                leading={<Icon name="crown" size={ICON_SIZE.lg} color={COLOR.reward.gold} />}
                title={t('pilot.profile.titles_row')}
                subtitle={displayTitle
                  ? `${displayTitle} · ${t('pilot.profile.titles_count', { n: String(all_unlocked_titles?.length || 0) })}`
                  : t('profile.no_title')}
                chevron
                onPress={() => setShowTitleModal(true)}
              />
            }
          />

          {/* ── Mes thèmes favoris ── */}
          <Section
            title={t('pilot.profile.fav_themes')}
            onSeeAll={favThemes.length > THEMES_SHOWN ? () => router.push('/theme-list?mine=1' as Href) : undefined}
          >
            {favThemes.length > 0 ? (
              <SatinSurface variant="card" contentStyle={s.listCard}>
                {favThemes.slice(0, THEMES_SHOWN).map((thm, i) => (
                  <React.Fragment key={thm.id}>
                    {i > 0 ? <Divider /> : null}
                    <ListRow
                      leading={<ThemeIcon themeId={thm.id} themeName={thm.name} cluster={thm.cluster} superCategory={thm.super_category} size={ICON_SIZE.theme.sm} />}
                      title={thm.name}
                      subtitle={thm.title || thm.cluster}
                      trailing={<Txt variant="label" color={COLOR.action.primary}>{`${t('profile.level_short')} ${thm.level}`}</Txt>}
                      chevron
                      onPress={() => router.push(`/category-detail?id=${thm.id}`)}
                    />
                  </React.Fragment>
                ))}
              </SatinSurface>
            ) : (
              <Txt variant="bodySmall">{t('profile.play_to_progress')}</Txt>
            )}
          </Section>

          {/* ── Historique (5 derniers, « Voir tout » déplie le reste) ── */}
          <Section
            title={t('pilot.profile.history_title')}
            onSeeAll={!historyExpanded && history.length > HISTORY_SHOWN ? () => setHistoryExpanded(true) : undefined}
          >
            {history.length === 0 ? (
              <Txt variant="bodySmall">{t('profile.no_matches')}</Txt>
            ) : (
              <SatinSurface variant="card" warm="none" contentStyle={s.listCard}>
                {historyShown.map((m, i) => {
                  const resultColor = m.won ? COLOR.status.success : COLOR.status.error;
                  const row = (
                    <View style={s.matchRow}>
                      <View style={[s.matchMark, { backgroundColor: resultColor }]} />
                      <View style={s.flex}>
                        <Txt variant="cardTitle" numberOfLines={1}>{`vs ${m.opponent}`}</Txt>
                        <Txt variant="caption" numberOfLines={1}>
                          {`${m.category} · ${new Date(m.created_at).toLocaleDateString('fr-FR')}`}
                        </Txt>
                      </View>
                      <View style={s.alignEnd}>
                        <Txt variant="cardTitle" style={s.tabular}>{`${m.player_score} - ${m.opponent_score}`}</Txt>
                        <View style={s.inline}>
                          <Txt variant="overline" color={resultColor}>{m.won ? t('profile.victory') : t('profile.defeat')}</Txt>
                          {m.xp_earned > 0 && <Txt variant="caption" color={COLOR.reward.gold} style={s.tabular}>{`+${fmt(m.xp_earned)} XP`}</Txt>}
                        </View>
                      </View>
                    </View>
                  );
                  return (
                    <React.Fragment key={m.id}>
                      {i > 0 ? <Divider /> : null}
                      {m.opponent_id ? (
                        <Pressable
                          onPress={() => router.push(`/player-profile?id=${m.opponent_id}`)}
                          accessibilityRole="button"
                          style={({ pressed }) => pressed && s.pressed}
                        >
                          {row}
                        </Pressable>
                      ) : row}
                    </React.Fragment>
                  );
                })}
              </SatinSurface>
            )}
          </Section>
        </View>
      </ScrollView>

      {/* ── Avatar ── */}
      <BottomSheet
        visible={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        title={t('profile.choose_avatar')}
        subtitle={t('profile.avatar_hint')}
      >
        <Button
          label={t('profile.upload_photo')}
          variant="secondary"
          icon="plus"
          onPress={handleUploadPhoto}
          disabled={savingAvatar}
          fullWidth
        />
        {presetAvatars.length > 0 && (
          <>
            <Txt variant="overline" style={s.sheetLabel}>{t('profile.available_avatars')}</Txt>
            <View style={s.avatarGrid}>
              {presetAvatars.map((a) => {
                const isSelected = user?.avatar_url === a.image_url;
                return (
                  <Pressable
                    key={a.id}
                    style={({ pressed }) => [s.avatarItem, pressed && s.pressed]}
                    onPress={() => handleSelectAvatar(a.id)}
                    disabled={savingAvatar}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={a.name}
                  >
                    <View style={[s.avatarRing, isSelected && s.avatarRingSelected]}>
                      <Image
                        source={{ uri: `${API_URL}/static/${a.image_url}` }}
                        style={s.avatarImage}
                        onError={() => {}}
                      />
                      {isSelected && (
                        <View style={s.avatarCheck}>
                          <Icon name="check" size={ICON_SIZE.sm} color={COLOR.text.onAction} />
                        </View>
                      )}
                    </View>
                    <Txt variant="caption" align="center" numberOfLines={1}>{a.name}</Txt>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        {savingAvatar && <Loader />}
      </BottomSheet>

      {/* ── Lieu ── */}
      <BottomSheet
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        title={t('profile.edit_location')}
        footer={
          <Button
            label={t('profile.save_location')}
            onPress={handleSaveLocation}
            loading={savingLocation}
            fullWidth
          />
        }
      >
        <TextInput
          style={s.input}
          placeholder={t('profile.your_city')}
          placeholderTextColor={COLOR.text.tertiary}
          value={locationCity}
          onChangeText={setLocationCity}
          autoCapitalize="words"
        />
        {/* Sélecteur de pays */}
        <Pressable
          style={[s.input, s.inputRow]}
          onPress={() => { setShowCountryDropdown(v => !v); setCountrySearch(''); }}
          accessibilityRole="button"
        >
          <View style={s.inline}>
            {locationCountry
              ? <Txt variant="body">{countryFlag(locationCountry) ?? ''}</Txt>
              : <Icon name="globe" size={ICON_SIZE.md} color={COLOR.text.tertiary} />}
            <Txt variant="body" color={locationCountry ? COLOR.text.primary : COLOR.text.tertiary}>
              {locationCountry || t('profile.your_country')}
            </Txt>
          </View>
          <Icon name="chevronDown" size={ICON_SIZE.md} color={COLOR.text.secondary} />
        </Pressable>
        {showCountryDropdown && (
          <View style={s.dropdown}>
            <TextInput
              style={s.dropdownSearch}
              placeholder={t('common.search')}
              placeholderTextColor={COLOR.text.tertiary}
              value={countrySearch}
              onChangeText={setCountrySearch}
              autoFocus
            />
            <ScrollView style={s.dropdownList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())).map(c => (
                <Pressable
                  key={c.name}
                  style={({ pressed }) => [s.countryOption, pressed && s.pressed]}
                  onPress={() => { setLocationCountry(c.name); setShowCountryDropdown(false); }}
                >
                  <Txt variant="body">{`${c.flag} ${c.name}`}</Txt>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </BottomSheet>

      {/* ── Titre ── */}
      <BottomSheet
        visible={showTitleModal}
        onClose={() => setShowTitleModal(false)}
        title={t('profile.choose_title')}
        subtitle={t('profile.title_hint')}
      >
        {(!all_unlocked_titles || all_unlocked_titles.length === 0) ? (
          <Txt variant="bodySmall" align="center" style={s.sheetEmpty}>{t('profile.play_to_unlock_titles')}</Txt>
        ) : (
          all_unlocked_titles.map((ttl) => {
            const isSelected = user?.selected_title === ttl.title;
            return (
              <ListRow
                key={`${ttl.theme_id}-${ttl.level}`}
                title={ttl.title}
                subtitle={`${ttl.theme_name} · ${t('profile.level_short')} ${ttl.level}`}
                trailing={isSelected ? <Icon name="check" size={ICON_SIZE.md} color={COLOR.action.primary} /> : null}
                onPress={savingTitle ? undefined : () => handleSelectTitle(ttl.title)}
                style={[s.titleOption, isSelected && s.titleOptionSelected]}
              />
            );
          })
        )}
      </BottomSheet>
    </View>
  );
}

const AVATAR_ITEM = 64;

const HERO_GLOW = 340;
const HERO_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };

const s = StyleSheet.create({
  levelRowSeparated: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle, paddingTop: SPACE.md },
  pointsLabel: { maxWidth: 104 },
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { justifyContent: 'center' },
  scroll: { paddingBottom: SIZE.tabBar + SPACE.giant },
  body: { paddingHorizontal: SPACE.screenX, gap: SPACE.sectionGap },
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alignEnd: { alignItems: 'flex-end' },
  tabular: { fontVariant: ['tabular-nums'] },
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
  divider: { height: BORDER.hair, backgroundColor: COLOR.border.subtle },

  errorCard: { marginHorizontal: SPACE.screenX, marginTop: SPACE.md },
  cardPad: { padding: SPACE.cardPad },

  /* Hero */
  hero: { alignItems: 'center', paddingTop: SPACE.lg, paddingBottom: SPACE.lg, paddingHorizontal: SPACE.screenX },
  gear: { position: 'absolute', top: SPACE.sm, right: SPACE.screenX },
  // Avatar : anneau jaune (moi) et halo chaud très doux
  avatarWrap: { marginBottom: SPACE.sm, borderRadius: RADII.pill, boxShadow: `0 0 28px 2px ${alpha(PALETTE.yellow, 0.28)}` },
  heroName: { alignSelf: 'stretch' },
  avatarEdit: {
    position: 'absolute', bottom: 0, right: 0,
    width: ICON_SIZE.xl, height: ICON_SIZE.xl, borderRadius: RADII.pill,
    backgroundColor: COLOR.action.primary,
    borderWidth: BORDER.strong, borderColor: COLOR.bg.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  // Lignes du hero serrées (32 px) ; hitSlop rend la cible tactile à 44 px
  heroLink: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, minHeight: SIZE.touch - SPACE.md, maxWidth: '100%', paddingHorizontal: SPACE.sm },

  /* Niveau + ligue */
  progressCard: { gap: SPACE.md },
  levelRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACE.md },
  leagueRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },

  /* Écusson commun (rang, succès) */
  crestBox: { alignItems: 'center', justifyContent: 'center' },
  crestIcon: { marginTop: -SPACE.xs },   // centre optique : la pointe du bas alourdit la forme

  /* Victoires + stats */
  cardsBlock: { gap: SPACE.lg },
  statsCard: { gap: SPACE.md },
  winRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.xs },
  statSep: { width: BORDER.hair, alignSelf: 'stretch', backgroundColor: COLOR.border.subtle, marginHorizontal: SPACE.sm },

  /* Social */
  socialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, marginTop: SPACE.xxs },
  socialItem: { minHeight: SIZE.touch - SPACE.md, paddingHorizontal: SPACE.sm, justifyContent: 'center' },
  socialDot: { width: SPACE.xs, height: SPACE.xs, borderRadius: RADII.pill, backgroundColor: COLOR.border.strong },

  /* Succès */
  achCard: { padding: SPACE.cardPad, paddingTop: SPACE.lg, gap: SPACE.sm },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.lg },
  achCell: { width: '25%', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.xxs },
  medalWrap: { alignItems: 'center', gap: SPACE.xs },
  medalLock: {
    position: 'absolute', top: -SPACE.xxs, right: -SPACE.sm,
    width: 20, height: 20, borderRadius: RADII.pill,
    backgroundColor: COLOR.bg.primary, borderWidth: BORDER.hair, borderColor: COLOR.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  glow: { position: 'absolute', left: '50%', top: '50%' },
  medalTrack: { height: BORDER.selected, borderRadius: RADII.pill, backgroundColor: COLOR.track, overflow: 'hidden' },
  medalFill: { height: '100%', borderRadius: RADII.pill, backgroundColor: COLOR.text.secondary },
  achDetail: { gap: SPACE.sm },

  /* Listes (thèmes, historique) */
  listCard: { paddingHorizontal: SPACE.cardPad },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: SIZE.listRow, paddingVertical: SPACE.sm },
  matchMark: { width: BORDER.selected, alignSelf: 'stretch', borderRadius: RADII.xs },

  /* Feuilles */
  sheetLabel: { marginTop: SPACE.sm },
  sheetEmpty: { paddingVertical: SPACE.xxl },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  avatarItem: { width: AVATAR_ITEM + SPACE.sm, alignItems: 'center', gap: SPACE.xs },
  avatarRing: { width: AVATAR_ITEM, height: AVATAR_ITEM, borderRadius: RADII.pill, borderWidth: BORDER.strong, borderColor: 'transparent', padding: SPACE.xxs },
  avatarRingSelected: { borderColor: COLOR.action.primary },
  avatarImage: { width: '100%', height: '100%', borderRadius: RADII.pill, backgroundColor: COLOR.surface.subtle },
  avatarCheck: {
    position: 'absolute', bottom: -SPACE.xxs, right: -SPACE.xxs,
    width: 22, height: 22, borderRadius: RADII.pill,
    backgroundColor: COLOR.action.primary, alignItems: 'center', justifyContent: 'center',
  },
  input: {
    ...TYPO.body,
    color: COLOR.text.primary,
    height: SIZE.input,
    borderRadius: RADII.md,
    borderWidth: BORDER.hair,
    borderColor: COLOR.border.default,
    backgroundColor: COLOR.bg.primary,
    paddingHorizontal: SPACE.lg,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdown: { borderRadius: RADII.md, borderWidth: BORDER.hair, borderColor: COLOR.border.default, backgroundColor: COLOR.bg.primary, overflow: 'hidden' },
  dropdownSearch: {
    ...TYPO.body,
    color: COLOR.text.primary,
    height: SIZE.input,
    paddingHorizontal: SPACE.lg,
    borderBottomWidth: BORDER.hair,
    borderBottomColor: COLOR.border.subtle,
  },
  dropdownList: { maxHeight: 200 },
  countryOption: { minHeight: SIZE.touch, justifyContent: 'center', paddingHorizontal: SPACE.lg },
  titleOption: { paddingHorizontal: SPACE.md, borderRadius: RADII.md, borderWidth: BORDER.hair, borderColor: 'transparent' },
  titleOptionSelected: { backgroundColor: COLOR.action.selectedFill, borderColor: COLOR.border.active },
});
