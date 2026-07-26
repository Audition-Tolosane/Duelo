import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Modal, Image, Alert, TextInput, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DueloHeader from '../../components/DueloHeader';
import UserAvatar from '../../components/UserAvatar';
import { GLASS } from '../../theme/glassTheme';
import { authFetch, clearToken } from '../../utils/api';
import { useTabBar } from '../../contexts/TabBarContext';
import { t } from '../../utils/i18n';
import CategoryIcon from '../../components/CategoryIcon';

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

const TIER_COLORS: Record<string, string> = {
  diamond: '#00D4FF', gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32',
};
const TIER_ICONS: Record<string, string> = {
  diamond: 'diamond-stone', gold: 'trophy', silver: 'shield-half-full', bronze: 'shield',
};

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

const CYAN = '#00E5FF';
const VIOLET = '#B366FF';
const GOLD = '#FFB547';
const MINT = '#32E7A3';
const RED = '#FF3D5E';

// ── Achievement icon mapping ──
const ACH_ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  first_game: 'gamepad-variant',
  games_10: 'target',
  games_50: 'sword-cross',
  games_100: 'check-decagram',
  win_first: 'trophy',
  wins_10: 'dumbbell',
  wins_50: 'crown',
  streak_3: 'fire',
  streak_7: 'lightning-bolt',
  streak_15: 'star-four-points',
  perfect_1: 'star',
  perfect_5: 'diamond',
  perfect_20: 'auto-fix',
  login_7: 'calendar-check',
  login_30: 'calendar-month',
  challenge_first: 'sword-cross',
  challenges_10: 'shield-star',
  themes_3: 'map-outline',
  themes_10: 'earth',
  daily_q_7: 'help-circle',
  daily_q_30: 'book-open-variant',
  missions_7: 'clipboard-check',
  missions_30: 'medal',
};

// ── Achievements Carousel ──
function AchievementsCarousel({ userId }: { userId: string }) {
  const [unlocked, setUnlocked] = useState<any[]>([]);
  const [inProgress, setInProgress] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedAch, setSelectedAch] = useState<any | null>(null);

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

  return (
    <View>
      <View style={achS.header}>
        <Text style={achS.title}>SUCCÈS</Text>
        <Text style={achS.counter}>{unlocked.length} / {all.length}</Text>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={all}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}
        renderItem={({ item }) => {
          const done = item.unlocked;
          const pct = done ? 1 : Math.min(1, (item.progress || 0) / (item.target || 1));
          const iconName = ACH_ICONS[item.id] ?? 'star-outline';
          return (
            <TouchableOpacity
              style={[achS.badge, done ? achS.badgeDone : achS.badgeLocked]}
              onPress={() => setSelectedAch(item)}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons
                name={iconName}
                size={24}
                color={done ? '#FFB547' : '#444'}
              />
              <Text style={[achS.name, { color: done ? '#FFB547' : '#555' }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={achS.progressBar}>
                <View style={[achS.progressFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: done ? '#FFB547' : '#333' }]} />
              </View>
              <Text style={achS.progressText}>
                {done ? '✓' : `${item.progress || 0}/${item.target}`}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Detail Modal */}
      <Modal visible={!!selectedAch} transparent animationType="fade" onRequestClose={() => setSelectedAch(null)}>
        <TouchableOpacity style={achS.modalOverlay} activeOpacity={1} onPress={() => setSelectedAch(null)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={achS.modalCard}>
              {selectedAch && (() => {
                const done = selectedAch.unlocked;
                const pct = done ? 1 : Math.min(1, (selectedAch.progress || 0) / (selectedAch.target || 1));
                const iconName = ACH_ICONS[selectedAch.id] ?? 'star-outline';
                return (
                  <>
                    <View style={[achS.modalIconCircle, { backgroundColor: done ? '#FFB54720' : '#FFFFFF08', borderColor: done ? '#FFB54750' : '#FFFFFF10' }]}>
                      <MaterialCommunityIcons name={iconName} size={36} color={done ? '#FFB547' : '#555'} />
                    </View>
                    <Text style={[achS.modalName, { color: done ? '#FFB547' : '#FFF' }]}>{selectedAch.name}</Text>
                    <Text style={achS.modalDesc}>{selectedAch.desc}</Text>
                    <View style={achS.modalProgressWrap}>
                      <View style={achS.modalProgressBar}>
                        <View style={[achS.modalProgressFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: done ? '#FFB547' : '#555' }]} />
                      </View>
                      <Text style={[achS.modalProgressLabel, { color: done ? '#FFB547' : '#888' }]}>
                        {done
                          ? `Débloqué${selectedAch.unlocked_at ? ' le ' + new Date(selectedAch.unlocked_at).toLocaleDateString('fr-FR') : ''}`
                          : `${selectedAch.progress || 0} / ${selectedAch.target}`}
                      </Text>
                    </View>
                    {!done && (
                      <Text style={achS.modalHint}>+{selectedAch.xp} XP à débloquer</Text>
                    )}
                  </>
                );
              })()}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const achS = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 14, marginTop: 24,
  },
  title: { fontSize: 12, fontWeight: '800', color: '#525252', letterSpacing: 3 },
  counter: { fontSize: 11, color: '#525252', fontWeight: '700', letterSpacing: 1 },
  badge: {
    alignItems: 'center', justifyContent: 'center',
    width: 76, borderRadius: 14, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 8, gap: 3,
  },
  badgeDone: { backgroundColor: '#1A1200', borderColor: '#FFB54760' },
  badgeLocked: { backgroundColor: '#111118', borderColor: '#FFFFFF08' },
  name: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  progressBar: { width: '100%', height: 3, backgroundColor: '#1A1A1A', borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  progressFill: { height: 3, borderRadius: 2 },
  progressText: { fontSize: 8, color: '#444', fontWeight: '600' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  modalCard: {
    backgroundColor: '#12121E', borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#FFFFFF12',
    minWidth: 260,
  },
  modalIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
  modalName: { fontSize: 16, fontWeight: '900' },
  modalDesc: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18 },
  modalProgressWrap: { width: '100%', gap: 6, alignItems: 'center' },
  modalProgressBar: { width: '100%', height: 6, backgroundColor: '#1A1A2E', borderRadius: 3, overflow: 'hidden' },
  modalProgressFill: { height: 6, borderRadius: 3 },
  modalProgressLabel: { fontSize: 12, fontWeight: '700' },
  modalHint: { fontSize: 11, color: '#444', fontWeight: '600' },
});
const GRID_PAD = 16;

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
  const [referralData, setReferralData] = useState<{
    code: string;
    total_referrals: number;
    confirmed_referrals: number;
    milestones: { count: number; delta_days: number }[];
    total_pro_days_earned: number;
    pro_active: boolean;
    pro_expires_at: string | null;
    min_matches_required: number;
    min_age_hours: number;
  } | null>(null);
  const [leagueData, setLeagueData] = useState<{
    mmr: number; tier: string; tier_label: string; tier_color: string;
    tier_progress: number; global_rank: number; season: { name: string };
    next_tier_label: string | null; next_tier_mmr: number | null;
  } | null>(null);

  useEffect(() => { loadProfile(); loadReferral(); loadLeague(); }, []);

  const loadReferral = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/referral/my-code`);
      if (res.ok) setReferralData(await res.json());
    } catch {}
  };

  const loadLeague = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/league/status`);
      if (res.ok) setLeagueData(await res.json());
    } catch {}
  };

  const handleShareReferral = () => {
    if (!referralData) return;
    const msg = `Rejoins-moi sur Duelo ! 🎮 Utilise mon code de parrainage : ${referralData.code}\nJoue 3 parties pour valider et me faire gagner du Pro !`;
    import('react-native').then(({ Share }) =>
      Share.share({ message: msg }).catch(() => {})
    );
  };

  const loadProfile = async () => {
    setProfileError(false);
    const userId = await AsyncStorage.getItem('duelo_user_id');
    const pseudo = await AsyncStorage.getItem('duelo_pseudo');
    const avatarSeed = await AsyncStorage.getItem('duelo_avatar_seed');
    if (!userId) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_URL}/api/profile-v2/${userId}?pseudo=${encodeURIComponent(pseudo || '')}`);
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

  const handleLogout = async () => {
    await clearToken();
    await AsyncStorage.multiRemove(['duelo_user_id', 'duelo_pseudo', 'duelo_avatar_seed', 'duelo_avatar_url']);
    router.replace('/');
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
    return <View style={{ flex: 1 }}><View style={s.loadingContainer}><ActivityIndicator size="large" color="#00E5FF" /></View></View>;
  }
  if (!profile || !profile.user) {
    return (
      <View style={{ flex: 1 }}>
        <View style={s.container}>
        <View style={s.emptyContainer}>
          <Text style={s.emptyText}>{t('profile.login_prompt')}</Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => router.replace('/')}>
            <Text style={s.loginBtnText}>{t('profile.login_button')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>
    );
  }

  const { user, themes, all_unlocked_titles, match_history } = profile;
  const displayTitle = user?.selected_title || (all_unlocked_titles && all_unlocked_titles.length > 0 ? all_unlocked_titles[0]?.title : '') || '';

  return (
    <View style={{ flex: 1 }}>
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} onScroll={onTabScroll} scrollEventThrottle={16}>

        {profileError && (
          <TouchableOpacity onPress={() => { setProfileError(false); setLoading(true); loadProfile(); }} style={{ padding: 12, alignItems: 'center', backgroundColor: 'rgba(255,61,94,0.08)', marginHorizontal: 16, borderRadius: 12, marginBottom: 8 }}>
            <Text style={{ color: '#FF3D5E', fontSize: 13, fontWeight: '600' }}>{t('profile.offline_error')}</Text>
          </TouchableOpacity>
        )}

        {/* ── Profile Header: Avatar centered ── */}
        <View style={s.profileHero}>
          <TouchableOpacity style={s.avatarContainer} onPress={openAvatarModal} activeOpacity={0.8}>
            <UserAvatar
              avatarUrl={user?.avatar_url}
              avatarSeed={user?.avatar_seed}
              pseudo={user?.pseudo}
              size={96}
              borderColor={GOLD}
              borderWidth={3}
            />
            <View style={s.avatarEditBadge}>
              <MaterialCommunityIcons name="pencil" size={12} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={s.pseudo}>{(user?.pseudo || t('profile.player_default')).toUpperCase()}</Text>
          {displayTitle ? (
            <TouchableOpacity style={s.titleBadge} onPress={() => setShowTitleModal(true)}>
              <MaterialCommunityIcons name="shield-star" size={12} color={VIOLET} />
              <Text style={s.titleText}>{displayTitle}</Text>
              <Text style={s.titleEditIcon}> ✎</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.titleBadge} onPress={() => setShowTitleModal(true)}>
              <Text style={s.titleTextEmpty}>{t('profile.no_title')}</Text>
              <Text style={s.titleEditIcon}> ✎</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.locationRow} onPress={openLocationModal} activeOpacity={0.7}>
            <Text style={s.locationFlag}>{user?.country_flag || '🌍'}</Text>
            <Text style={s.locationText}>
              {user?.city && user?.country
                ? `${user.city}, ${user.country}`
                : user?.country || t('profile.world')}
            </Text>
            <MaterialCommunityIcons name="pencil" size={12} color="#525252" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        {/* ── Stats Row: DUELS / VICTOIRES / RATIO ── */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: CYAN }]}>{user?.matches_played || 0}</Text>
            <Text style={s.statLabel}>DUELS</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: MINT }]}>{user?.matches_won || 0}</Text>
            <Text style={s.statLabel}>VICTOIRES</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: GOLD }]}>{user?.win_rate || 0}%</Text>
            <Text style={s.statLabel}>RATIO</Text>
          </View>
        </View>

        {/* ── Social Stats (followers) ── */}
        <View style={s.socialRow}>
          <TouchableOpacity onPress={() => router.push(`/followers?userId=${profile?.user.id}&type=followers`)} style={s.socialItem}>
            <Text style={s.socialValue}>{user?.followers_count || 0}</Text>
            <Text style={s.socialLabel}>{t('profile.followers_label')}</Text>
          </TouchableOpacity>
          <View style={s.socialDivider} />
          <TouchableOpacity onPress={() => router.push(`/followers?userId=${profile?.user.id}&type=following`)} style={s.socialItem}>
            <Text style={s.socialValue}>{user?.following_count || 0}</Text>
            <Text style={s.socialLabel}>{t('profile.following_label')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Level XP Progress ── */}
        {user && (() => {
          const lvl = getXpLevel(user.total_xp || 0);
          const { current, needed, progress } = getXpInLevel(user.total_xp || 0, lvl);
          return (
            <View style={s.xpProgressCard}>
              <View style={s.xpProgressRow}>
                <View style={s.xpLevelBadge}>
                  <MaterialCommunityIcons name="lightning-bolt" size={12} color="#00E5FF" />
                  <Text style={s.xpLevelText}>Niv. {lvl}</Text>
                </View>
                <Text style={s.xpTotalText}>{(user.total_xp || 0).toLocaleString()} XP total</Text>
                <Text style={s.xpNextText}>→ Niv. {Math.min(lvl + 1, 50)}</Text>
              </View>
              <View style={s.xpBarBg}>
                <LinearGradient
                  colors={['#00E5FF', '#B366FF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[s.xpBarFill, { width: `${Math.round(progress * 100)}%` as any }]}
                />
              </View>
              <Text style={s.xpBarHint}>{current.toLocaleString()} / {needed.toLocaleString()} XP</Text>
            </View>
          );
        })()}

        {/* ── League Badge ── */}
        {leagueData && (() => {
          const color = TIER_COLORS[leagueData.tier] || '#CD7F32';
          const icon = TIER_ICONS[leagueData.tier] || 'shield';
          return (
            <LinearGradient
              colors={[`${color}1E`, `${color}08`]}
              style={[s.leagueCard, { borderColor: `${color}40` }]}
            >
              <MaterialCommunityIcons name={icon as any} size={24} color={color} />
              <View style={s.leagueInfo}>
                <Text style={[s.leagueTier, { color }]}>{leagueData.tier_label}</Text>
                <Text style={s.leagueMMR}>{leagueData.mmr} MMR · {leagueData.season.name}</Text>
                <View style={s.leagueBarBg}>
                  <View style={[s.leagueBarFill, { width: `${Math.round(leagueData.tier_progress * 100)}%` as any, backgroundColor: color }]} />
                </View>
              </View>
              <View style={s.leagueRankBox}>
                <Text style={s.leagueRankNum}>#{leagueData.global_rank}</Text>
                <Text style={s.leagueRankLabel}>rang</Text>
              </View>
            </LinearGradient>
          );
        })()}

        {/* ── Quick Stats ── */}
        <Text style={s.sectionTitle}>{t('profile.statistics')}</Text>
        <View style={s.quickStats}>
          {[
            { icon: 'trophy' as const, label: t('profile.wins'), value: user?.matches_won || 0, color: '#FFB547' },
            { icon: 'chart-line' as const, label: t('profile.win_rate'), value: `${user?.win_rate || 0}%`, color: '#00E5FF' },
            { icon: 'fire' as const, label: t('player.streak'), value: user?.current_streak || 0, color: '#FF6B35' },
            { icon: 'star' as const, label: t('profile.best_streak'), value: user?.best_streak || 0, color: '#E040FB' },
          ].map((stat, i) => (
            <View key={i} style={s.qStatBox}>
              <LinearGradient
                colors={[stat.color + '22', stat.color + '08']}
                style={s.qStatIconCircle}
              >
                <MaterialCommunityIcons name={stat.icon} size={18} color={stat.color} />
              </LinearGradient>
              <Text style={[s.qStatVal, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.qStatLbl}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Mes Thèmes (theme-based XP) ── */}
        {themes && themes.length > 0 && (
          <>
            <Text style={s.sectionTitle}>{t('profile.my_themes')}</Text>
            <View style={s.topicsGrid}>
              {themes.map((thm) => (
                <TouchableOpacity
                  key={thm.id}
                  style={s.topicCard}
                  onPress={() => router.push(`/category-detail?id=${thm.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={[s.topicCardInner, { borderColor: thm.color_hex + '30' }]}>
                    <View style={[s.topicIconBox, { backgroundColor: thm.color_hex + '20' }]}>
                      <CategoryIcon themeId={thm.id} size={22} color={thm.color_hex} type="theme" />
                    </View>
                    <Text style={[s.topicName, { color: thm.color_hex }]} numberOfLines={1}>{thm.name}</Text>
                    <Text style={s.topicLevel}>{t('profile.level_short')} {thm.level}</Text>
                    <View style={s.topicBarBg}>
                      <View style={[s.topicBarFill, { width: `${(thm.xp_progress?.progress || 0) * 100}%`, backgroundColor: thm.color_hex }]} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {(!themes || themes.length === 0) && (
          <>
            <Text style={s.sectionTitle}>{t('profile.my_themes')}</Text>
            <Text style={s.noHistory}>{t('profile.play_to_progress')}</Text>
          </>
        )}

        {/* ── Succès ── */}
        <AchievementsCarousel userId={user?.id || ''} />

        {/* ── Titles ── */}
        {all_unlocked_titles && all_unlocked_titles.length > 0 && (
          <>
            <Text style={s.sectionTitle}>{t('profile.my_titles')}</Text>
            <View style={s.titlesWrap}>
              {all_unlocked_titles.map((ttl, i) => {
                const isSelected = user?.selected_title === ttl.title;
                return (
                  <TouchableOpacity
                    key={`${ttl.theme_id}-${ttl.level}`}
                    style={[s.titleChip, isSelected && { borderColor: '#B366FF', backgroundColor: 'rgba(179,102,255,0.15)' }]}
                    onPress={() => handleSelectTitle(ttl.title)}
                  >
                    <Text style={s.titleChipText}>{ttl.theme_name}</Text>
                    <Text style={[s.titleChipTitle, isSelected && { color: '#B57EDC' }]}>{ttl.title}</Text>
                    {isSelected && <Text style={s.titleChipCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* ── Match History ── */}
        <Text style={s.sectionTitle}>{t('profile.history')}</Text>
        {match_history && match_history.length === 0 ? (
          <Text style={s.noHistory}>{t('profile.no_matches')}</Text>
        ) : (
          match_history.map((m) => (
            <View key={m.id} style={[s.matchCard, m.won && s.matchCardWon]}>
              <View style={s.matchLeft}>
                <View style={s.matchCatBadge}>
                  <Text style={s.matchCatText}>{m.category}</Text>
                </View>
                <View>
                  {m.opponent_id ? (
                    <TouchableOpacity onPress={() => router.push(`/player-profile?id=${m.opponent_id}`)}>
                      <Text style={[s.matchOpp, { textDecorationLine: 'underline' }]}>vs {m.opponent}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={s.matchOpp}>vs {m.opponent}</Text>
                  )}
                  <Text style={s.matchDate}>{new Date(m.created_at).toLocaleDateString('fr-FR')}</Text>
                </View>
              </View>
              <View style={s.matchRight}>
                <Text style={[s.matchScore, m.won ? s.scoreWin : s.scoreLoss]}>
                  {m.player_score} - {m.opponent_score}
                </Text>
                <View style={s.matchXpRow}>
                  <Text style={[s.matchResult, m.won ? s.resultWin : s.resultLoss]}>
                    {m.won ? t('profile.victory') : t('profile.defeat')}
                  </Text>
                  {m.xp_earned > 0 && <Text style={s.matchXp}>+{m.xp_earned} XP</Text>}
                </View>
              </View>
            </View>
          ))
        )}

        {/* ── Parrainage ── */}
        {referralData && (
          <View style={s.referralCard}>
            {/* Header */}
            <View style={s.referralHeader}>
              <LinearGradient colors={['#32E7A320', '#00E5FF10']} style={s.referralIconCircle}>
                <MaterialCommunityIcons name="account-plus" size={18} color="#32E7A3" />
              </LinearGradient>
              <Text style={s.referralTitle}>{t('referral.title')}</Text>
              {referralData.pro_active && referralData.pro_expires_at && (
                <View style={s.referralProBadge}>
                  <MaterialCommunityIcons name="crown" size={11} color="#FFB547" />
                  <Text style={s.referralProBadgeText}>PRO</Text>
                </View>
              )}
            </View>

            {/* Code */}
            <View style={s.referralCodeRow}>
              <Text style={s.referralCodeLabel}>{t('referral.your_code')}</Text>
              <View style={s.referralCodeBox}>
                <Text style={s.referralCode}>{referralData.code}</Text>
              </View>
            </View>

            {/* Paliers visuels */}
            <View style={s.referralMilestones}>
              {[
                { count: 1, label: '1 j Pro',   total: 1 },
                { count: 2, label: '3 j Pro',   total: 3 },
                { count: 3, label: '7 j Pro',   total: 7 },
              ].map((m) => {
                const done = referralData.confirmed_referrals >= m.count;
                return (
                  <View key={m.count} style={[s.referralMilestoneItem, done && s.referralMilestoneDone]}>
                    <MaterialCommunityIcons
                      name={done ? 'check-circle' : 'circle-outline'}
                      size={16} color={done ? '#32E7A3' : '#444'}
                    />
                    <Text style={[s.referralMilestoneLabel, done && { color: '#32E7A3' }]}>
                      {m.count} filleul{m.count > 1 ? 's' : ''} → {m.label}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Progression filleuls */}
            <Text style={s.referralProgress}>
              {referralData.confirmed_referrals}/{3} filleuls confirmés
              {referralData.total_referrals > referralData.confirmed_referrals && (
                ` · ${referralData.total_referrals - referralData.confirmed_referrals} en attente`
              )}
            </Text>

            {/* Info anti-abus */}
            <Text style={s.referralAntiAbuse}>
              Un filleul est confirmé après {referralData.min_matches_required} parties + compte lié + 24h
            </Text>

            {/* Pro expiry */}
            {referralData.pro_active && referralData.pro_expires_at && (
              <View style={s.referralProRow}>
                <MaterialCommunityIcons name="crown" size={13} color="#FFB547" />
                <Text style={s.referralProText}>
                  Pro jusqu'au {new Date(referralData.pro_expires_at).toLocaleDateString()}
                </Text>
              </View>
            )}

            {/* Partager */}
            <TouchableOpacity style={s.referralShareBtn} onPress={handleShareReferral} activeOpacity={0.8}>
              <LinearGradient colors={['#32E7A3', '#00E5FF']} style={s.referralShareGrad}>
                <MaterialCommunityIcons name="share-variant" size={14} color="#000" />
                <Text style={s.referralShareText}>{t('referral.share')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Paramètres ── */}
        <Text style={s.sectionTitle}>{t('profile.settings')}</Text>
        <View style={s.settingsWrap}>
          {[
            { icon: 'account-circle-outline' as const, label: t('profile.change_avatar'), color: '#00BFFF', onPress: openAvatarModal },
            { icon: 'tag-outline' as const, label: t('profile.change_title'), color: '#B366FF', onPress: () => setShowTitleModal(true) },
            { icon: 'bell-outline' as const, label: t('settings.notifications'), color: '#FFB547', onPress: () => router.push('/notification-settings') },
            { icon: 'translate' as const, label: t('settings.language'), color: '#4ECDC4', onPress: () => router.push('/language-settings') },
            { icon: 'file-document-outline' as const, label: t('settings.terms'), color: '#A3A3A3', onPress: () => router.push('/terms') },
            { icon: 'headset' as const, label: t('settings.support'), color: '#FF6B35', onPress: () => router.push('/support') },
          ].map((item, idx, arr) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity style={s.settingsRow} onPress={item.onPress} activeOpacity={0.7}>
                <LinearGradient
                  colors={[item.color + '20', item.color + '08']}
                  style={s.settingsIconCircle}
                >
                  <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                </LinearGradient>
                <Text style={s.settingsText}>{item.label}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.2)" />
              </TouchableOpacity>
              {idx < arr.length - 1 && <View style={s.settingsDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Déconnexion */}
        <TouchableOpacity style={s.logoutRow} onPress={handleLogout} activeOpacity={0.7}>
          <LinearGradient
            colors={['rgba(255,61,94,0.15)', 'rgba(255,61,94,0.05)']}
            style={s.settingsIconCircle}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#FF3D5E" />
          </LinearGradient>
          <Text style={[s.settingsText, { color: '#FF3D5E' }]}>{t('settings.logout')}</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#FF3D5E40" />
        </TouchableOpacity>

        {/* Suppression de compte */}
        {!profile?.user?.is_guest && (
          <TouchableOpacity
            style={s.deleteAccountRow}
            onPress={() => {
              Alert.alert(
                t('profile.delete_account_title'),
                t('profile.delete_account_confirm'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('profile.delete_account_confirm_btn'),
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const res = await authFetch(`${API_URL}/api/auth/delete-account`, { method: 'DELETE' });
                        if (res.ok) {
                          await clearToken();
                          await AsyncStorage.multiRemove(['duelo_user_id', 'duelo_pseudo', 'duelo_avatar_seed', 'duelo_avatar_url']);
                          router.replace('/');
                        } else {
                          Alert.alert(t('common.error'), t('profile.error_network'));
                        }
                      } catch {
                        Alert.alert(t('common.error'), t('profile.error_network'));
                      }
                    },
                  },
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={s.deleteAccountText}>{t('profile.delete_account')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Avatar Selection Modal */}
      <Modal visible={showAvatarModal} transparent animationType="fade" onRequestClose={() => setShowAvatarModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>{t('profile.choose_avatar')}</Text>
            <Text style={s.modalHint}>{t('profile.avatar_hint')}</Text>

            {/* Upload photo button */}
            <TouchableOpacity
              style={s.uploadPhotoBtn}
              onPress={handleUploadPhoto}
              disabled={savingAvatar}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#00BFFF20', '#00BFFF08']}
                style={s.uploadPhotoGradient}
              >
                <MaterialCommunityIcons name="camera-plus" size={22} color="#00BFFF" />
                <Text style={s.uploadPhotoText}>{t('profile.upload_photo')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Presets grid */}
            {presetAvatars.length > 0 && (
              <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={s.avatarGridLabel}>{t('profile.available_avatars')}</Text>
                <View style={s.avatarGrid}>
                  {presetAvatars.map((a) => {
                    const isSelected = user?.avatar_url === a.image_url;
                    return (
                      <TouchableOpacity
                        key={a.id}
                        style={[s.avatarGridItem, isSelected && s.avatarGridItemSelected]}
                        onPress={() => handleSelectAvatar(a.id)}
                        disabled={savingAvatar}
                        activeOpacity={0.7}
                      >
                        <Image
                          source={{ uri: `${API_URL}/static/${a.image_url}` }}
                          style={s.avatarGridImage}
                          onError={() => {}}
                        />
                        <Text style={s.avatarGridName} numberOfLines={1}>{a.name}</Text>
                        {isSelected && (
                          <View style={s.avatarGridCheck}>
                            <MaterialCommunityIcons name="check-circle" size={18} color="#32E7A3" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {savingAvatar && <ActivityIndicator color="#00E5FF" style={{ marginVertical: 12 }} />}

            <TouchableOpacity style={s.modalClose} onPress={() => setShowAvatarModal(false)}>
              <Text style={s.modalCloseText}>{t('profile.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Location Edit Modal */}
      <Modal visible={showLocationModal} transparent animationType="fade" onRequestClose={() => setShowLocationModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { gap: 12 }]}>
            <Text style={s.modalTitle}>{t('profile.edit_location')}</Text>
            <TextInput
              style={s.locationInput}
              placeholder={t('profile.your_city')}
              placeholderTextColor="#525252"
              value={locationCity}
              onChangeText={setLocationCity}
              autoCapitalize="words"
            />
            {/* Country selector */}
            <TouchableOpacity
              style={[s.locationInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => { setShowCountryDropdown(v => !v); setCountrySearch(''); }}
              activeOpacity={0.8}
            >
              <Text style={{ color: locationCountry ? '#FFF' : '#525252', fontSize: 15 }}>
                {locationCountry
                  ? `${COUNTRIES.find(c => c.name === locationCountry)?.flag || '🌍'} ${locationCountry}`
                  : t('profile.your_country')}
              </Text>
              <MaterialCommunityIcons name={showCountryDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#A3A3A3" />
            </TouchableOpacity>
            {showCountryDropdown && (
              <View style={s.countryDropdown}>
                <TextInput
                  style={s.countrySearchInput}
                  placeholder="Rechercher..."
                  placeholderTextColor="#525252"
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  autoFocus
                />
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                  {COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())).map(c => (
                    <TouchableOpacity
                      key={c.name}
                      style={s.countryOption}
                      onPress={() => { setLocationCountry(c.name); setShowCountryDropdown(false); }}
                    >
                      <Text style={s.countryOptionText}>{c.flag} {c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <TouchableOpacity
              style={[s.modalClose, { backgroundColor: '#B366FF' }]}
              onPress={handleSaveLocation}
              disabled={savingLocation}
            >
              {savingLocation
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={[s.modalCloseText, { color: '#FFF' }]}>{t('profile.save_location')}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={s.modalClose} onPress={() => setShowLocationModal(false)}>
              <Text style={s.modalCloseText}>{t('profile.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Title Selection Modal */}
      <Modal visible={showTitleModal} transparent animationType="fade" onRequestClose={() => setShowTitleModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>{t('profile.choose_title')}</Text>
            <Text style={s.modalHint}>{t('profile.title_hint')}</Text>
            {(!all_unlocked_titles || all_unlocked_titles.length === 0) ? (
              <View style={s.modalEmpty}>
                <Text style={s.modalEmptyText}>{t('profile.play_to_unlock_titles')}</Text>
              </View>
            ) : (
              <ScrollView style={s.modalScroll}>
                {all_unlocked_titles.map((ttl) => {
                  const isSelected = user?.selected_title === ttl.title;
                  return (
                    <TouchableOpacity
                      key={`${ttl.theme_id}-${ttl.level}`}
                      style={[s.modalItem, isSelected && { borderColor: '#B366FF', backgroundColor: 'rgba(179,102,255,0.10)' }]}
                      onPress={() => handleSelectTitle(ttl.title)}
                      disabled={savingTitle}
                    >
                      <View style={s.modalItemInfo}>
                        <Text style={[s.modalItemTitle, isSelected && { color: '#B57EDC' }]}>{ttl.title}</Text>
                        <Text style={s.modalItemSub}>{ttl.theme_name} - {t('profile.level_short')} {ttl.level}</Text>
                      </View>
                      {isSelected && <Text style={s.modalItemCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={s.modalClose} onPress={() => setShowTitleModal(false)}>
              <Text style={s.modalCloseText}>{t('profile.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#A3A3A3', fontSize: 16, marginBottom: 16 },
  loginBtn: { backgroundColor: '#B366FF', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  loginBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  scroll: { paddingBottom: 120 },

  /* ── Profile Header ── */
  profileHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: GRID_PAD, paddingVertical: 20, gap: 16,
  },
  // profileHero defined above (near-duplicate kept for safety)
  avatarContainer: { position: 'relative' as const },
  avatarEditBadge: {
    position: 'absolute' as const, bottom: 0, right: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#B366FF', justifyContent: 'center' as const, alignItems: 'center' as const,
    borderWidth: 2, borderColor: '#050510',
  },
  profileHero: { alignItems: 'center', paddingTop: 16, paddingBottom: 20, paddingHorizontal: GRID_PAD },
  profileInfo: { flex: 1 },
  pseudo: { fontSize: 30, fontWeight: '900', fontFamily: 'SpaceGrotesk_700Bold', color: '#FFF', letterSpacing: 0.5, marginTop: 12 },
  titleBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4, alignSelf: 'center' },
  titleText: { color: '#B57EDC', fontSize: 13, fontWeight: '700' },
  titleTextEmpty: { color: '#525252', fontSize: 13, fontWeight: '600', fontStyle: 'italic' },
  titleEditIcon: { color: '#525252', fontSize: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  locationFlag: { fontSize: 14 },
  locationText: { color: '#A3A3A3', fontSize: 13, fontWeight: '600' },

  /* Stats Row */
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: GRID_PAD, paddingVertical: 18,
    backgroundColor: GLASS.bg, borderRadius: GLASS.radius,
    borderWidth: 1, borderColor: GLASS.borderCyan,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '900', fontFamily: 'SpaceGrotesk_700Bold', color: '#FFF' },
  statLabel: { fontSize: 9, fontWeight: '800', fontFamily: 'JetBrainsMono_700Bold', color: 'rgba(255,255,255,0.45)', letterSpacing: 2, marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: GLASS.borderSubtle },

  /* Social Row (followers / following) */
  socialRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: GRID_PAD, marginTop: 8, gap: 32,
  },
  socialItem: { alignItems: 'center' },
  socialValue: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  socialLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginTop: 2 },
  socialDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },

  /* ── Level XP Progress ── */
  xpProgressCard: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
  },
  xpProgressRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8,
  },
  xpLevelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(179,102,255,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  xpLevelText: { fontSize: 11, fontWeight: '800', color: '#00E5FF' },
  xpTotalText: { flex: 1, fontSize: 10, color: '#555', fontWeight: '600' },
  xpNextText: { fontSize: 10, color: '#00E5FF', fontWeight: '700' },
  xpBarBg: {
    height: 5, backgroundColor: 'rgba(0,229,255,0.12)', borderRadius: 3, overflow: 'hidden',
  },
  xpBarFill: { height: 5, borderRadius: 3 },
  xpBarHint: { fontSize: 9, color: '#444', marginTop: 4, textAlign: 'right' },

  /* ── League Card ── */
  leagueCard: {
    marginHorizontal: 16, marginTop: 12, borderRadius: 14,
    borderWidth: 1, flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  leagueInfo: { flex: 1 },
  leagueTier: { fontSize: 15, fontWeight: '900', marginBottom: 2 },
  leagueMMR: { fontSize: 10, color: '#555', fontWeight: '600', marginBottom: 6 },
  leagueBarBg: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden',
  },
  leagueBarFill: { height: 4, borderRadius: 2 },
  leagueRankBox: { alignItems: 'center' },
  leagueRankNum: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  leagueRankLabel: { fontSize: 9, color: '#555', fontWeight: '600' },

  /* Section Title */
  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: '#525252', letterSpacing: 3,
    marginBottom: 14, marginTop: 24, paddingHorizontal: GRID_PAD,
  },

  /* ── Topics Grid ── */
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GRID_PAD - 5 },
  topicCard: { width: '25%', padding: 5, alignItems: 'center' },
  topicCardInner: {
    width: '100%', borderRadius: GLASS.radius, paddingVertical: 12, paddingHorizontal: 6,
    borderWidth: 1, backgroundColor: GLASS.bg, alignItems: 'center',
    borderColor: GLASS.borderSubtle,
  },
  topicIconBox: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  topicIcon: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  topicName: { fontSize: 10, fontWeight: '800', marginBottom: 2, textAlign: 'center' },
  topicLevel: { fontSize: 9, fontWeight: '700', color: '#A3A3A3', letterSpacing: 0.5, marginBottom: 6 },
  topicBarBg: { width: '80%', height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  topicBarFill: { height: 4, borderRadius: 2 },

  /* Quick Stats */
  quickStats: { flexDirection: 'row', gap: 8, paddingHorizontal: GRID_PAD },
  qStatBox: {
    flex: 1, backgroundColor: GLASS.bg, borderRadius: GLASS.radius,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: GLASS.borderCyan,
  },
  qStatIconCircle: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  qStatVal: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  qStatLbl: { fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },

  /* Titles */
  titlesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: GRID_PAD, marginBottom: 8 },
  titleChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: GLASS.radius, backgroundColor: GLASS.bgLight,
    borderWidth: 1, borderColor: GLASS.borderSubtle, gap: 6,
  },
  titleChipText: { color: '#666', fontSize: 10, fontWeight: '600' },
  titleChipTitle: { color: '#A3A3A3', fontSize: 13, fontWeight: '600' },
  titleChipCheck: { fontSize: 14, fontWeight: '800', color: '#B366FF' },

  /* Match History */
  noHistory: { color: '#525252', fontSize: 14, textAlign: 'center', paddingVertical: 20, paddingHorizontal: GRID_PAD },
  matchCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: GLASS.bg, borderRadius: GLASS.radius, padding: 14,
    marginBottom: 8, marginHorizontal: GRID_PAD, borderWidth: 1, borderColor: GLASS.borderCyan,
  },
  matchCardWon: { borderColor: 'rgba(50,231,163,0.15)', backgroundColor: 'rgba(50,231,163,0.04)' },
  matchLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  matchCatBadge: {
    backgroundColor: 'rgba(179,102,255,0.15)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  matchCatText: { color: '#B57EDC', fontSize: 10, fontWeight: '700' },
  matchOpp: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  matchDate: { color: '#525252', fontSize: 11, marginTop: 2 },
  matchRight: { alignItems: 'flex-end' },
  matchScore: { fontSize: 16, fontWeight: '800' },
  scoreWin: { color: '#32E7A3' },
  scoreLoss: { color: '#FF3D5E' },
  matchXpRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  matchResult: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  resultWin: { color: '#32E7A3' },
  resultLoss: { color: '#FF3D5E' },
  matchXp: { color: '#00E5FF', fontSize: 10, fontWeight: '700' },

  /* Settings */
  settingsWrap: {
    marginHorizontal: GRID_PAD, borderRadius: 20, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 12,
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
  },
  settingsIconCircle: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  settingsText: { flex: 1, color: '#E0E0E0', fontSize: 15, fontWeight: '600' },
  settingsDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginLeft: 66 },

  // Parrainage
  referralCard: {
    marginHorizontal: GRID_PAD, marginBottom: 16, borderRadius: 18,
    backgroundColor: 'rgba(50,231,163,0.05)', borderWidth: 1, borderColor: 'rgba(50,231,163,0.15)',
    padding: 16,
  },
  referralHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  referralIconCircle: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  referralTitle: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '800' },
  referralProBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,181,71,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  referralProBadgeText: { color: '#FFB547', fontSize: 10, fontWeight: '900' },
  referralCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  referralCodeLabel: { color: '#888', fontSize: 12 },
  referralCodeBox: { backgroundColor: 'rgba(50,231,163,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(50,231,163,0.2)' },
  referralCode: { color: '#32E7A3', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  referralMilestones: { gap: 8, marginBottom: 12 },
  referralMilestoneItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  referralMilestoneDone: {},
  referralMilestoneLabel: { color: '#666', fontSize: 12, fontWeight: '600' },
  referralProgress: { color: '#888', fontSize: 12, marginBottom: 4 },
  referralAntiAbuse: { color: '#444', fontSize: 10, fontStyle: 'italic', marginBottom: 12 },
  referralProRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  referralProText: { color: '#FFB547', fontSize: 12, fontWeight: '700' },
  referralShareBtn: { borderRadius: 10, overflow: 'hidden' },
  referralShareGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  referralShareText: { color: '#000', fontSize: 13, fontWeight: '900' },

  logoutRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: GRID_PAD, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 20, backgroundColor: 'rgba(255,61,94,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,61,94,0.12)', marginBottom: 12,
  },
  deleteAccountRow: {
    marginHorizontal: GRID_PAD, marginBottom: 32,
    paddingVertical: 10, alignItems: 'center',
  },
  deleteAccountText: {
    color: 'rgba(255,61,94,0.45)', fontSize: 12, fontWeight: '600',
    textDecorationLine: 'underline',
  },

  /* Avatar Modal */
  uploadPhotoBtn: { marginBottom: 16, borderRadius: 14, overflow: 'hidden' as const },
  uploadPhotoGradient: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,191,255,0.2)',
  },
  uploadPhotoText: { color: '#00BFFF', fontSize: 14, fontWeight: '700' },
  avatarGridLabel: { fontSize: 10, fontWeight: '800', color: '#525252', letterSpacing: 2, marginBottom: 10 },
  avatarGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 },
  avatarGridItem: {
    width: 72, alignItems: 'center' as const, padding: 6, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  avatarGridItemSelected: { borderColor: '#32E7A3', backgroundColor: 'rgba(50,231,163,0.08)' },
  avatarGridImage: { width: 52, height: 52, borderRadius: 26, marginBottom: 4 },
  avatarGridName: { color: '#A3A3A3', fontSize: 9, fontWeight: '600', textAlign: 'center' as const },
  avatarGridCheck: { position: 'absolute' as const, top: 4, right: 4 },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', paddingHorizontal: 24 },
  modalContent: {
    backgroundColor: GLASS.bgDark, borderRadius: GLASS.radiusLg, padding: 24, maxHeight: '70%',
    borderWidth: 1.5, borderColor: GLASS.borderCyan,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  modalHint: { fontSize: 13, color: '#525252', marginBottom: 20 },
  modalEmpty: { alignItems: 'center', paddingVertical: 30 },
  modalEmptyText: { color: '#525252', fontSize: 14, textAlign: 'center' },
  modalScroll: { maxHeight: 300 },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  modalItemInfo: { flex: 1 },
  modalItemTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  modalItemSub: { color: '#525252', fontSize: 11, marginTop: 2 },
  modalItemCheck: { fontSize: 18, fontWeight: '800', color: '#B366FF' },
  modalClose: {
    marginTop: 16, padding: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalCloseText: { color: '#A3A3A3', fontSize: 14, fontWeight: '600' },
  locationInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    color: '#FFF', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12,
    width: '100%',
  },
  countryDropdown: {
    width: '100%', backgroundColor: '#0E0E1E',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  countrySearchInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#FFF', fontSize: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  countryOption: {
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  countryOptionText: { color: '#FFF', fontSize: 14 },
});
