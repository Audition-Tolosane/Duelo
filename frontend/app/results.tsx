import React, { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, Animated, Share, Pressable, ScrollView, TextInput, Keyboard, Dimensions,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { authFetch } from '../utils/api';
import { playSound } from '../utils/sounds';
import SwipeBackPage from '../components/SwipeBackPage';
import UserAvatar from '../components/UserAvatar';
import { useWS } from '../contexts/WebSocketContext';
import { t, pluralKey } from '../utils/i18n';
import {
  Txt, Icon, IconName, Button, Badge, Card, Loader, Dialog, BottomSheet,
  ScreenContainer, ScreenHeader, ThemeIcon, ResultState,
} from '../components/ui';
import { COLOR, SPACE, RADII, SIZE, BORDER, ICON_SIZE, TYPO, PALETTE } from '../theme/tokens';

// Fin de duel SKILKI : en-tête ResultState (victoire = halo jaune, défaite = pétrole sobre,
// sans-faute = violet rare), score moi (jaune) / rival (corail), XP en or, révision des erreurs,
// actions (revanche jaune, partage, accueil). Logique, API et WebSocket inchangés.

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORY_NAMES: Record<string, string> = {};

// Confettis de victoire / montée de niveau : couleurs de la palette SKILKI
const CONFETTI = [PALETTE.yellow, PALETTE.gold, PALETTE.coral, PALETTE.green, PALETTE.cream];

type XpBreakdown = {
  base: number;
  victory: number;
  perfection: number;
  giant_slayer: number;
  streak: number;
  total: number;
};

type QuizQuestion = {
  id: string;
  question_text: string;
  options: string[];
  correct_option: number;
};

type Reward =
  | { type: 'shield'; streakBefore: number }
  | { type: 'level'; level: number }
  | { type: 'title'; title: string; category: string; level: number }
  | { type: 'achievement'; name: string; description: string; icon: string };

const REPORT_REASONS: { id: string; labelKey: string; icon: IconName }[] = [
  { id: 'wrong_answer', labelKey: 'report.reason_wrong_answer', icon: 'error' },
  { id: 'unclear_question', labelKey: 'report.reason_unclear', icon: 'help' },
  { id: 'typo', labelKey: 'report.reason_typo', icon: 'edit' },
  { id: 'outdated', labelKey: 'report.reason_outdated', icon: 'calendar' },
  { id: 'other', labelKey: 'report.reason_other', icon: 'message' },
];

export default function ResultsScreen() {
  const router = useRouter();
  const { send, on } = useWS();
  const params = useLocalSearchParams<{
    playerScore: string; opponentScore: string; opponentPseudo: string;
    category: string; userId: string; isBot: string;
    correctCount: string; opponentLevel: string; opponentId: string;
    asyncChallenge: string; challengeOpponent: string; opponentDisconnected: string;
  }>();
  const opponentLeft = params.opponentDisconnected === 'true';
  const isAsyncChallenge = params.asyncChallenge === 'true';
  const challengeOpponentName = params.challengeOpponent ? decodeURIComponent(params.challengeOpponent) : '';

  const category = params.category || '';

  const pScore = parseInt(params.playerScore || '0');
  const oScore = parseInt(params.opponentScore || '0');
  const correctCount = parseInt(params.correctCount || '0');
  const won = pScore > oScore;
  const draw = pScore === oScore;
  const isBot = params.isBot === 'true';

  // Rematch states: idle | waiting | declined | accepted
  const [rematchState, setRematchState] = useState<'idle' | 'waiting' | 'declined' | 'accepted'>('idle');
  const rematchStateRef = useRef(rematchState);
  // #22 — Guard against double navigation from concurrent WS events + safety timeout
  const hasNavigatedRef = useRef(false);
  const [xpBreakdown, setXpBreakdown] = useState<XpBreakdown | null>(null);
  const [newLevel, setNewLevel] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(true);
  const [submitError, setSubmitError] = useState<{ kind: 'auth' | 'network'; status: number | null } | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [streakBefore, setStreakBefore] = useState(0);
  const [adWatching, setAdWatching] = useState(false);
  const [adCountdown, setAdCountdown] = useState(3);
  const [streakRestored, setStreakRestored] = useState(false);

  // Unified rewards modal
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [showRewardsModal, setShowRewardsModal] = useState(false);

  const confettiRef = useRef<any>(null);
  const [playerPseudo, setPlayerPseudo] = useState(t('game.player'));

  // Report question states
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [playerAnswers, setPlayerAnswers] = useState<number[]>([]);
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportStep, setReportStep] = useState<'select' | 'reason'>('select');
  const [selectedQuestion, setSelectedQuestion] = useState<QuizQuestion | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const cardSlide = useRef(new Animated.Value(60)).current;
  const xpSlide = useRef(new Animated.Value(40)).current;

  // Compteur XP qui s'incrémente 0 → total (écran résultats)
  const xpCountAnim = useRef(new Animated.Value(0)).current;
  const [displayXp, setDisplayXp] = useState(0);

  // Keep ref in sync to avoid stale closures in WS listeners
  useEffect(() => { rematchStateRef.current = rematchState; }, [rematchState]);

  // Anime le compteur XP dès que le détail des points est disponible
  useEffect(() => {
    const total = xpBreakdown?.total ?? 0;
    if (total <= 0) { setDisplayXp(total); return; }
    xpCountAnim.setValue(0);
    const id = xpCountAnim.addListener(({ value }) => setDisplayXp(Math.round(value)));
    Animated.timing(xpCountAnim, {
      toValue: total, duration: 900, delay: 300, useNativeDriver: false,
    }).start();
    return () => xpCountAnim.removeListener(id);
  }, [xpBreakdown]);

  useEffect(() => {
    submitMatch();
    loadQuizQuestions();
    loadPlayerPseudo();
    Haptics.notificationAsync(
      won ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(xpSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start(() => {
      if (won) setTimeout(() => confettiRef.current?.start(), 100);
    });

    // Rematch WS listeners
    const unsubs = [
      on('rematch_accepted', (msg) => {
        // Seul celui qui a proposé navigue d'ici ; celui qui accepte est guidé par RematchModal.
        if (rematchStateRef.current !== 'waiting') return;
        setRematchState('accepted');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const roomId = msg?.data?.room_id;
        setTimeout(() => {
          if (hasNavigatedRef.current) return;
          hasNavigatedRef.current = true;
          router.replace(
            roomId
              ? `/matchmaking?room_id=${roomId}&category=${category}&challenge=true&rematch=true&opponentPseudo=${encodeURIComponent(params.opponentPseudo || '')}`
              : `/matchmaking?category=${category}`
          );
        }, 600);
      }),
      on('rematch_declined', () => {
        setRematchState('declined');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }),
      on('rematch_expired', () => {
        if (rematchStateRef.current === 'waiting') {
          setRematchState('declined');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Safety timeout: if waiting for rematch response for > 20s, fallback
  useEffect(() => {
    if (rematchState !== 'waiting') return;
    const timeout = setTimeout(() => {
      setRematchState('declined');
    }, 20000);
    return () => clearTimeout(timeout);
  }, [rematchState]);

  const submitMatch = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const userId = params.userId || await AsyncStorage.getItem('duelo_user_id');
      const body = JSON.stringify({
        player_id: userId,
        theme_id: category,
        player_score: pScore,
        opponent_score: oScore,
        opponent_pseudo: params.opponentPseudo,
        opponent_is_bot: params.isBot === 'true',
        correct_count: correctCount,
        opponent_level: parseInt(params.opponentLevel || '1'),
      });
      // 3 tentatives avec backoff sur pannes réseau / erreurs serveur —
      // et surtout : plus JAMAIS d'échec silencieux (bandeau + Réessayer).
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await authFetch(`${API_URL}/api/game/submit-v2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          });
          if (res.ok || (res.status < 500 && res.status !== 429)) break;
        } catch { res = null; }
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
      if (!res || !res.ok) {
        console.warn(`[submit-v2] ${res ? res.status : 'network'} - theme_id="${category}"`);
        setSubmitError({
          kind: res && (res.status === 401 || res.status === 403) ? 'auth' : 'network',
          status: res ? res.status : null,
        });
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      if (data.id) setMatchId(data.id);
      if (data.xp_breakdown) {
        setXpBreakdown(data.xp_breakdown);
      }
      const collected: Reward[] = [];
      if (data.streak_broken && data.streak_before > 0) {
        setStreakBefore(data.streak_before);
        collected.push({ type: 'shield', streakBefore: data.streak_before });
      }
      if (data.new_level) {
        setNewLevel(data.new_level);
        collected.push({ type: 'level', level: data.new_level });
      }
      if (data.new_title) {
        collected.push({
          type: 'title',
          title: data.new_title.title,
          category: data.new_title.category,
          level: data.new_title.level,
        });
      }
      if (data.new_achievements?.length > 0) {
        data.new_achievements.forEach((ach: { name: string; description: string; icon: string }) => {
          collected.push({ type: 'achievement', name: ach.name, description: ach.description, icon: ach.icon });
        });
      }
      if (collected.length > 0) {
        setRewards(collected);
        setTimeout(() => {
          setShowRewardsModal(true);
          if (collected.some(r => r.type === 'level' || r.type === 'title')) {
            playSound('victory');
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 900);
      }
    } catch (e) { console.error(e); setSubmitError({ kind: 'network', status: null }); }
    setSubmitting(false);
  };

  const closeRewardsModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowRewardsModal(false);
  };

  const watchAdAndRestoreStreak = async () => {
    if (!matchId) return;
    setAdWatching(true);
    setAdCountdown(3);
    // Fake ad countdown
    for (let i = 3; i > 0; i--) {
      setAdCountdown(i);
      await new Promise(r => setTimeout(r, 1000));
    }
    setAdWatching(false);
    try {
      const res = await authFetch(`${API_URL}/api/game/restore-streak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId }),
      });
      if (res.ok) {
        setStreakRestored(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {}
  };

  const shareResult = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const categoryName = CATEGORY_NAMES[category || ''] || category;
    const xpPart = xpBreakdown ? ` · +${xpBreakdown.total} XP` : '';
    const levelPart = newLevel ? ` · ${t('results.level_up')} ${newLevel} ↑` : '';
    const text = won
      ? `🏆 ${t('results.share_victory')} ${pScore}-${oScore} en ${categoryName} (${correctCount}/7)${xpPart}${levelPart}. ${t('results.share_challenge')} #SKILKI`
      : `⚔️ ${t('results.share_intense')} ${pScore}-${oScore} en ${categoryName}${xpPart}. ${t('results.share_beat_me')} #SKILKI`;
    try { await Share.share({ message: text }); } catch (e) { console.error(e); }
  };

  const loadQuizQuestions = async () => {
    try {
      const raw = await AsyncStorage.getItem('duelo_last_quiz_questions');
      if (raw) {
        const parsed = JSON.parse(raw);
        setQuizQuestions(parsed);
      }
      const ansRaw = await AsyncStorage.getItem('duelo_last_player_answers');
      if (ansRaw) {
        const parsed = JSON.parse(ansRaw);
        if (Array.isArray(parsed)) setPlayerAnswers(parsed);
      }
    } catch (e) { console.error(e); }
  };

  const loadPlayerPseudo = async () => {
    try {
      const p = await AsyncStorage.getItem('duelo_pseudo');
      if (p) setPlayerPseudo(p);
    } catch (e) { console.error(e); }
  };

  const openReportModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReportStep('select');
    setSelectedQuestion(null);
    setSelectedReason(null);
    setReportDescription('');
    setReportSuccess(false);
    setReportError(null);
    setReportModalVisible(true);
  };

  const selectQuestionForReport = (q: QuizQuestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedQuestion(q);
    setReportStep('reason');
    setReportError(null);
  };

  const submitReport = async () => {
    if (!selectedQuestion || !selectedReason) return;
    Keyboard.dismiss();
    setReportSubmitting(true);
    setReportError(null);
    // #43 — 10s timeout so the modal never stays frozen
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const userId = params.userId || await AsyncStorage.getItem('duelo_user_id');
      const res = await authFetch(`${API_URL}/api/questions/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          question_id: selectedQuestion.id,
          question_text: selectedQuestion.question_text,
          category: category,
          reason_type: selectedReason,
          description: reportDescription.trim() || undefined,
        }),
        signal: controller.signal,
      });
      if (res.status === 409) {
        setReportError(t('report.already_reported'));
      } else if (!res.ok) {
        setReportError(t('report.send_error'));
      } else {
        setReportSuccess(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      setReportError(e?.name === 'AbortError' ? t('report.network_error') : t('report.network_error'));
    } finally {
      clearTimeout(timeoutId);
      setReportSubmitting(false);
    }
  };

  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, []);

  const newDuel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    router.replace(`/matchmaking?category=${category}`);
  };

  const playAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (rematchState === 'waiting') return;
    if (rematchState === 'declined') { newDuel(); return; }

    setRematchState('waiting');

    if (isBot || !params.opponentId) {
      // Simulate bot response: 70% accept, 30% decline after 2-3s
      const delay = 2000 + Math.random() * 1500;
      const accepts = Math.random() < 0.7;
      botTimerRef.current = setTimeout(() => {
        if (accepts) {
          setRematchState('accepted');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            router.replace(`/matchmaking?category=${category}&rematch=true&botPseudo=${encodeURIComponent(params.opponentPseudo || '')}`);
          }, 800);
        } else {
          setRematchState('declined');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }, delay);
      return;
    }

    // Real player: propose rematch via WebSocket
    send({
      action: 'rematch_propose',
      opponent_id: params.opponentId,
      theme_id: category,
    });
  };

  // Near-miss: lost (or drew) by 1 point and has at least one missed question
  const scoreGap = oScore - pScore;
  const isNearMiss = !won && scoreGap >= 0 && scoreGap <= 1 && playerAnswers.length > 0;

  // Missed questions (player's selected answer differs from correct_option)
  const missedQuestions = quizQuestions
    .map((q, i) => ({ q, i, playerAnswer: playerAnswers[i] ?? -1 }))
    .filter(({ q, playerAnswer }) => playerAnswer !== q.correct_option);

  const goBack = () => {
    if (router.canGoBack()) { router.back(); } else { router.replace(category ? `/category-detail?id=${category}` : '/(tabs)/play'); }
  };

  const outcome = won ? (correctCount >= 7 ? 'flawless' : 'victory') : draw ? 'draw' : 'defeat';
  const opponentName = params.opponentPseudo || t('game.opponent');

  type XpRow = { key: string; label: string; value: number; icon?: IconName };
  const xpRows: XpRow[] = xpBreakdown ? ([
    { key: 'base', label: t('pilot.results.base'), value: xpBreakdown.base },
    { key: 'victory', label: t('pilot.results.victory_bonus'), value: xpBreakdown.victory, icon: 'trophy' },
    { key: 'perfection', label: t('pilot.results.perfection'), value: xpBreakdown.perfection, icon: 'star' },
    { key: 'giant', label: t('pilot.results.giant_slayer'), value: xpBreakdown.giant_slayer, icon: 'duel' },
    { key: 'streak', label: t('pilot.results.streak_bonus'), value: xpBreakdown.streak, icon: 'flame' },
  ] as XpRow[]).filter((r) => r.key === 'base' || r.value > 0) : [];

  return (
    <SwipeBackPage>
    <ScreenContainer ambient={false}>
      <ScreenHeader
        title={t('pilot.results.title')}
        onBack={goBack}
        right={category ? <ThemeIcon themeId={category} size={ICON_SIZE.theme.sm} /> : undefined}
      />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Défi asynchrone : score enregistré, l'autre joueur jouera plus tard */}
        {isAsyncChallenge && (
          <Card style={s.bannerRow}>
            <Icon name="clock" size={ICON_SIZE.md} color={COLOR.text.secondary} />
            <View style={s.flex}>
              <Txt variant="cardTitle">{t('challenge.async_saved')}</Txt>
              {challengeOpponentName ? (
                <Txt variant="bodySmall">{challengeOpponentName} {t('challenge.async_will_play')}</Txt>
              ) : null}
            </View>
          </Card>
        )}

        {/* Adversaire parti : victoire par forfait */}
        {opponentLeft && (
          <Card accent="event" style={s.forfeit}>
            <Txt variant="overline">{t('results.forfeit_eyebrow')}</Txt>
            <Txt variant="h3">{t('results.forfeit_title', { name: opponentName })}</Txt>
            <Txt variant="bodySmall">{t('results.forfeit_body')}</Txt>
            <Badge label={t('results.forfeit_chip')} tone="success" />
          </Card>
        )}

        {/* En-tête du résultat (moment émotionnel : halo du kit) */}
        <Animated.View style={[s.resultShell, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <ResultState
            outcome={outcome}
            subtitle={t('pilot.results.correct_count', { n: String(correctCount) })}
          />
          {(draw && correctCount >= 7) || newLevel || isNearMiss ? (
            <View style={s.resultBadges}>
              {draw && correctCount >= 7 ? <Badge label={t('pilot.results.flawless')} tone="rare" /> : null}
              {newLevel ? <Badge label={t('pilot.results.level_up', { n: String(newLevel) })} tone="reward" /> : null}
              {isNearMiss ? (
                <View style={s.nearMiss}>
                  <Icon name="flame" size={ICON_SIZE.sm} color={COLOR.accent.warm} />
                  <Txt variant="bodySmall" color={COLOR.text.primary} style={s.flexShrink}>{t('results.near_miss')}</Txt>
                </View>
              ) : null}
            </View>
          ) : null}
        </Animated.View>

        {/* Score : moi (jaune) / rival (corail) */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: cardSlide }] }}>
          <Card style={s.scoreCard}>
            <View style={s.scoreSide}>
              <UserAvatar pseudo={playerPseudo} size={56} borderColor={COLOR.player.self} borderWidth={BORDER.strong} />
              <Txt variant="label" color={COLOR.text.primary} align="center" numberOfLines={1} style={s.stretch}>{playerPseudo}</Txt>
              <Txt variant="score" color={COLOR.player.self}>{pScore}</Txt>
              {won ? <Badge label={t('pilot.results.winner')} tone="action" /> : <View style={s.badgeSpacer} />}
            </View>

            <Txt variant="overline" style={s.vs}>{draw ? '=' : 'VS'}</Txt>

            <View style={s.scoreSide}>
              <UserAvatar pseudo={opponentName} size={56} borderColor={COLOR.player.opponent} borderWidth={BORDER.strong} />
              {params.opponentId ? (
                <Pressable
                  onPress={() => router.push(`/player-profile?id=${params.opponentId}`)}
                  accessibilityRole="link"
                  hitSlop={8}
                  style={s.stretch}
                >
                  <Txt variant="label" color={COLOR.player.opponentText} align="center" numberOfLines={1} style={s.underline}>
                    {opponentName}
                  </Txt>
                </Pressable>
              ) : (
                <Txt variant="label" color={COLOR.player.opponentText} align="center" numberOfLines={1} style={s.stretch}>{opponentName}</Txt>
              )}
              <Txt variant="score" color={COLOR.player.opponentText}>{oScore}</Txt>
              {!won && !draw ? <Badge label={t('pilot.results.winner')} tone="warm" /> : <View style={s.badgeSpacer} />}
            </View>
          </Card>
        </Animated.View>

        {/* XP gagnés (récompense : or) */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: xpSlide }] }}>
          <Card accent={won ? 'reward' : 'none'} style={s.xpCard}>
            {submitting ? (
              <Loader />
            ) : xpBreakdown ? (
              <>
                <View style={s.rowCenter}>
                  <Icon name="bolt" size={ICON_SIZE.sm} color={COLOR.reward.gold} />
                  <Txt variant="overline">{t('pilot.results.xp_title')}</Txt>
                </View>
                {xpRows.map((r) => (
                  <View key={r.key} style={s.xpRow}>
                    <View style={[s.rowCenter, s.flexShrink]}>
                      {r.icon ? <Icon name={r.icon} size={ICON_SIZE.sm} color={COLOR.reward.gold} /> : null}
                      <Txt variant="bodySmall" numberOfLines={1} style={s.flexShrink}>{r.label}</Txt>
                    </View>
                    <Txt variant="label" color={r.key === 'base' ? COLOR.text.primary : COLOR.reward.gold}>
                      +{r.value.toLocaleString()}
                    </Txt>
                  </View>
                ))}
                <View style={[s.xpRow, s.xpTotal]}>
                  <Txt variant="cardTitle">{t('pilot.results.total')}</Txt>
                  <Txt variant="statMedium" color={COLOR.reward.gold}>+{displayXp.toLocaleString()} XP</Txt>
                </View>
              </>
            ) : submitError ? (
              /* Échec d'enregistrement VISIBLE — plus de score perdu en silence */
              <View style={s.submitError}>
                <Icon name={submitError.kind === 'auth' ? 'user' : 'offline'} size={ICON_SIZE.lg} color={COLOR.status.errorText} />
                <Txt variant="body" color={COLOR.text.primary} align="center">
                  {submitError.kind === 'auth' ? t('results.submit_error_auth') : t('results.submit_error_network')}
                </Txt>
                {/* Détail technique — permet de diagnostiquer sans les logs Metro */}
                <Txt variant="caption" align="center">
                  {submitError.status ? `HTTP ${submitError.status}` : t('pilot.results.no_response')}
                </Txt>
                {submitError.kind === 'network' && (
                  <Button label={t('common.retry')} icon="refresh" variant="secondary" size="sm" onPress={submitMatch} />
                )}
              </View>
            ) : null}
          </Card>
        </Animated.View>

        {/* Révision des erreurs (dépliable) */}
        {missedQuestions.length > 0 && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Card padded={false}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setReviewExpanded(v => !v);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: reviewExpanded }}
                style={({ pressed }) => [s.reviewHeader, pressed && s.pressed]}
              >
                <Icon name="book" size={ICON_SIZE.md} color={COLOR.text.secondary} />
                <View style={s.flex}>
                  <Txt variant="cardTitle">{t('pilot.results.review_title')}</Txt>
                  <Txt variant="caption">
                    {t(pluralKey('pilot.results.review', missedQuestions.length), { n: String(missedQuestions.length) })}
                  </Txt>
                </View>
                <View style={reviewExpanded ? s.chevronUp : undefined}>
                  <Icon name="chevronDown" size={ICON_SIZE.md} color={COLOR.text.tertiary} />
                </View>
              </Pressable>
              {reviewExpanded && (
                <View style={s.reviewList}>
                  {missedQuestions.map(({ q, i, playerAnswer }) => {
                    const correctText = q.options[q.correct_option];
                    const yourText = playerAnswer >= 0 ? q.options[playerAnswer] : null;
                    return (
                      <View key={q.id || i} style={s.reviewItem}>
                        <Txt variant="body">{q.question_text}</Txt>
                        {yourText ? (
                          <View style={s.answerRow}>
                            <Icon name="error" size={ICON_SIZE.sm} color={COLOR.status.errorText} />
                            <Txt variant="bodySmall" color={COLOR.status.errorText} numberOfLines={2} style={s.flexShrink}>{yourText}</Txt>
                          </View>
                        ) : (
                          <View style={s.answerRow}>
                            <Icon name="timer" size={ICON_SIZE.sm} color={COLOR.text.tertiary} />
                            <Txt variant="bodySmall" color={COLOR.text.tertiary} style={s.flexShrink}>{t('results.review_timeout')}</Txt>
                          </View>
                        )}
                        <View style={s.answerRow}>
                          <Icon name="success" size={ICON_SIZE.sm} color={COLOR.status.success} />
                          <Txt variant="bodySmall" color={COLOR.status.success} numberOfLines={2} style={s.flexShrink}>{correctText}</Txt>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          </Animated.View>
        )}

        {/* Actions : un seul CTA jaune (revanche) */}
        <Animated.View style={[s.actions, { opacity: fadeAnim }]}>
          {rematchState === 'waiting' ? (
            <>
              <Button testID="play-again-btn" label={t('pilot.results.rematch')} loading fullWidth size="lg" onPress={playAgain} />
              <Txt variant="caption" align="center">{t('pilot.results.waiting_rematch')}</Txt>
            </>
          ) : rematchState === 'declined' ? (
            <Button testID="play-again-btn" label={t('pilot.results.declined')} icon="replay" variant="secondary" fullWidth size="lg" onPress={playAgain} />
          ) : rematchState === 'accepted' ? (
            <Button testID="play-again-btn" label={t('pilot.results.accepted')} icon="check" fullWidth size="lg" disabled onPress={playAgain} />
          ) : (
            <Button testID="play-again-btn" label={t('pilot.results.rematch')} icon="duel" fullWidth size="lg" onPress={playAgain} />
          )}
          <Button testID="share-result-btn" label={t('pilot.results.share')} icon="share" variant="secondary" fullWidth onPress={shareResult} />
          <Button testID="go-home-btn" label={t('results.back_home')} icon="home" variant="ghost" fullWidth onPress={() => router.replace('/(tabs)/accueil')} />

          {quizQuestions.length > 0 && (
            <Pressable
              testID="report-error-btn"
              onPress={openReportModal}
              accessibilityRole="button"
              style={({ pressed }) => [s.reportLink, pressed && s.pressed]}
            >
              <Icon name="warning" size={ICON_SIZE.sm} color={COLOR.text.secondary} />
              <Txt variant="label">{t('results.report_error')}</Txt>
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>

      {/* Récompenses (montée de niveau, titre, succès, bouclier de série) */}
      <Dialog
        visible={showRewardsModal}
        onClose={closeRewardsModal}
        title={t('pilot.results.rewards_title')}
        icon="gift"
        tone="reward"
        actions={<Button label={t('pilot.results.continue')} fullWidth onPress={closeRewardsModal} />}
      >
        <ScrollView style={s.rewardsScroll} contentContainerStyle={s.rewardsList} showsVerticalScrollIndicator={false}>
          {rewards.map((r, i) => (
            <RewardRow
              key={`${r.type}-${i}`}
              reward={r}
              streakRestored={streakRestored}
              adWatching={adWatching}
              adCountdown={adCountdown}
              onWatchAd={watchAdAndRestoreStreak}
            />
          ))}
        </ScrollView>
      </Dialog>
      {showRewardsModal && rewards.some(r => r.type === 'level' || r.type === 'title') && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ConfettiCannon count={120} origin={{ x: SCREEN_WIDTH / 2, y: -10 }} autoStart fadeOut explosionSpeed={350} fallSpeed={2800} colors={CONFETTI} />
        </View>
      )}

      {/* Signalement d'une question */}
      <BottomSheet
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        title={reportSuccess ? t('report.thanks') : reportStep === 'select' ? t('report.title') : t('pilot.results.report_details')}
        subtitle={!reportSuccess && reportStep === 'select' ? t('report.which_question') : undefined}
        footer={
          reportSuccess ? (
            <Button label={t('pilot.results.close')} variant="secondary" fullWidth onPress={() => setReportModalVisible(false)} />
          ) : reportStep === 'reason' ? (
            <View style={s.reportActions}>
              <Button label={t('common.back')} icon="back" variant="ghost" onPress={() => setReportStep('select')} style={s.flex} />
              <Button
                label={t('pilot.results.send')}
                icon="send"
                onPress={submitReport}
                loading={reportSubmitting}
                disabled={!selectedReason || reportSubmitting}
                style={s.flex}
              />
            </View>
          ) : undefined
        }
      >
        {reportSuccess ? (
          <View style={s.reportSuccess}>
            <View style={s.successDisc}><Icon name="success" size={ICON_SIZE.xl} color={COLOR.status.success} /></View>
            <Txt variant="h3" align="center">{t('pilot.results.report_sent')}</Txt>
            <Txt variant="bodySmall" align="center">{t('pilot.results.report_thanks')}</Txt>
          </View>
        ) : reportStep === 'select' ? (
          quizQuestions.map((q, idx) => (
            <Pressable
              key={q.id || idx.toString()}
              onPress={() => selectQuestionForReport(q)}
              accessibilityRole="button"
              style={({ pressed }) => [s.questionRow, pressed && s.pressed]}
            >
              <View style={s.questionNumber}><Txt variant="label" color={COLOR.text.primary}>{idx + 1}</Txt></View>
              <Txt variant="bodySmall" color={COLOR.text.primary} numberOfLines={2} style={s.flex}>{q.question_text}</Txt>
              <Icon name="chevronRight" size={ICON_SIZE.sm} color={COLOR.text.disabled} />
            </Pressable>
          ))
        ) : (
          <>
            <View style={s.selectedPreview}>
              <Txt variant="overline">{t('pilot.results.report_selected')}</Txt>
              <Txt variant="bodySmall" color={COLOR.text.primary} numberOfLines={2}>{selectedQuestion?.question_text}</Txt>
            </View>

            <Txt variant="overline" style={s.sectionLabel}>{t('report.error_type')}</Txt>
            {REPORT_REASONS.map((r) => {
              const active = selectedReason === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => { setSelectedReason(r.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [s.reasonRow, active && s.reasonActive, pressed && s.pressed]}
                >
                  <Icon name={r.icon} size={ICON_SIZE.sm} color={active ? COLOR.action.primary : COLOR.text.secondary} />
                  <Txt variant="body" color={active ? COLOR.text.primary : COLOR.text.secondary} style={s.flex}>{t(r.labelKey)}</Txt>
                  {active ? <Icon name="check" size={ICON_SIZE.sm} color={COLOR.action.primary} /> : null}
                </Pressable>
              );
            })}

            <Txt variant="overline" style={s.sectionLabel}>{t('report.description_optional')}</Txt>
            <TextInput
              style={s.input}
              placeholder={t('report.describe_error')}
              placeholderTextColor={COLOR.text.tertiary}
              selectionColor={COLOR.action.primary}
              value={reportDescription}
              onChangeText={setReportDescription}
              multiline
              maxLength={500}
              maxFontSizeMultiplier={1.3}
              textAlignVertical="top"
            />
            <Txt variant="caption" align="right">{reportDescription.length}/500</Txt>

            {reportError && (
              <View style={s.answerRow}>
                <Icon name="error" size={ICON_SIZE.sm} color={COLOR.status.errorText} />
                <Txt variant="bodySmall" color={COLOR.status.errorText} style={s.flexShrink}>{reportError}</Txt>
              </View>
            )}
          </>
        )}
      </BottomSheet>

      {/* Confettis — victoire (animation existante, couleurs de la palette) */}
      {won && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ConfettiCannon
            ref={confettiRef}
            count={140}
            origin={{ x: SCREEN_WIDTH / 2, y: -10 }}
            autoStart={false}
            fadeOut={true}
            explosionSpeed={350}
            fallSpeed={2800}
            colors={CONFETTI}
          />
        </View>
      )}
    </ScreenContainer>
    </SwipeBackPage>
  );
}

type RewardRowProps = {
  reward: Reward;
  streakRestored: boolean;
  adWatching: boolean;
  adCountdown: number;
  onWatchAd: () => void;
};

function RewardRow({ reward, streakRestored, adWatching, adCountdown, onWatchAd }: RewardRowProps) {
  const disc = (name: IconName, color: string) => (
    <View style={s.rewardDisc}><Icon name={name} size={ICON_SIZE.lg} color={color} /></View>
  );
  switch (reward.type) {
    case 'level':
      return (
        <View style={s.rewardRow}>
          {disc('trend', COLOR.reward.gold)}
          <View style={s.flex}>
            <Txt variant="overline" color={COLOR.reward.gold}>{t('results.new_level_reached')}</Txt>
            <Txt variant="h3">{t('pilot.results.level_up', { n: String(reward.level) })}</Txt>
          </View>
        </View>
      );
    case 'title':
      return (
        <View style={s.rewardRow}>
          {disc('crown', COLOR.reward.gold)}
          <View style={s.flex}>
            <Txt variant="overline" color={COLOR.reward.gold}>{t('results.new_title_unlocked')}</Txt>
            <Txt variant="h3" numberOfLines={2}>{reward.title}</Txt>
            <Txt variant="caption">{t('pilot.results.level_up', { n: String(reward.level) })}</Txt>
          </View>
        </View>
      );
    case 'achievement':
      return (
        <View style={s.rewardRow}>
          {disc('medal', COLOR.reward.gold)}
          <View style={s.flex}>
            <Txt variant="overline" color={COLOR.reward.gold}>{t('results.achievement_unlocked')}</Txt>
            <Txt variant="cardTitle">{reward.name}</Txt>
            <Txt variant="caption">{reward.description}</Txt>
          </View>
        </View>
      );
    case 'shield':
      return (
        <View style={s.rewardRow}>
          {disc(streakRestored ? 'flame' : adWatching ? 'tv' : 'shield', COLOR.accent.warm)}
          <View style={s.flex}>
            {streakRestored ? (
              <>
                <Txt variant="cardTitle">{t('pilot.results.streak_restored')}</Txt>
                <Txt variant="caption">{t('pilot.results.streak_restored_sub', { n: String(reward.streakBefore) })}</Txt>
              </>
            ) : adWatching ? (
              <>
                <Txt variant="overline">{t('results.ad_watching')}</Txt>
                <Txt variant="statMedium">{adCountdown}</Txt>
              </>
            ) : (
              <>
                <Txt variant="cardTitle">{t('pilot.results.shield_title', { n: String(reward.streakBefore) })}</Txt>
                <Txt variant="caption">{t('pilot.results.shield_sub')}</Txt>
                <Button label={t('results.watch_ad')} icon="tv" variant="secondary" size="sm" onPress={onWatchAd} style={s.adBtn} />
              </>
            )}
          </View>
        </View>
      );
  }
}

const s = StyleSheet.create({
  content: { paddingHorizontal: SPACE.screenX, paddingTop: SPACE.lg, paddingBottom: SPACE.huge, gap: SPACE.lg },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  stretch: { alignSelf: 'stretch' },
  pressed: { opacity: 0.7 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },

  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  forfeit: { gap: SPACE.sm },

  // Coque : le halo de ResultState est rogné par la carte
  resultShell: { borderRadius: RADII.xl, overflow: 'hidden', backgroundColor: COLOR.surface.subtle },
  resultBadges: { alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xl, marginTop: -SPACE.lg },
  nearMiss: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, maxWidth: '100%' },

  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  scoreSide: { flex: 1, minWidth: 0, alignItems: 'center', gap: SPACE.xs },
  vs: { paddingHorizontal: SPACE.xs },
  underline: { textDecorationLine: 'underline' },
  badgeSpacer: { height: 20 },

  xpCard: { gap: SPACE.sm },
  xpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md, minHeight: 24 },
  xpTotal: { borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle, paddingTop: SPACE.md, marginTop: SPACE.xs },
  submitError: { alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.sm },

  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.cardPad, minHeight: SIZE.listRow },
  chevronUp: { transform: [{ rotate: '180deg' }] },
  reviewList: { paddingHorizontal: SPACE.cardPad, paddingBottom: SPACE.cardPad, gap: SPACE.lg },
  reviewItem: { gap: SPACE.xs, borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle, paddingTop: SPACE.md },
  answerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },

  actions: { gap: SPACE.md },
  reportLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, minHeight: SIZE.touch },

  rewardsScroll: { maxHeight: 360 },
  rewardsList: { gap: SPACE.md },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  rewardDisc: {
    width: 48, height: 48, borderRadius: RADII.md,
    backgroundColor: COLOR.surface.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  adBtn: { alignSelf: 'flex-start', marginTop: SPACE.sm },

  reportActions: { flexDirection: 'row', gap: SPACE.sm },
  reportSuccess: { alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.lg },
  successDisc: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLOR.status.successFill,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.xs,
  },
  questionRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    minHeight: SIZE.listRow, paddingVertical: SPACE.sm,
    borderBottomWidth: BORDER.hair, borderBottomColor: COLOR.border.subtle,
  },
  questionNumber: {
    width: 32, height: 32, borderRadius: RADII.sm,
    backgroundColor: COLOR.surface.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  selectedPreview: { gap: SPACE.xs, padding: SPACE.md, borderRadius: RADII.md, backgroundColor: COLOR.surface.subtle },
  sectionLabel: { marginTop: SPACE.md },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    minHeight: SIZE.touch, paddingHorizontal: SPACE.md,
    borderRadius: RADII.md, borderWidth: BORDER.hair, borderColor: COLOR.border.default,
  },
  reasonActive: { borderColor: COLOR.border.active, backgroundColor: COLOR.action.selectedFill },
  input: {
    minHeight: 96, ...TYPO.body, color: COLOR.text.primary,
    backgroundColor: COLOR.surface.input,
    borderRadius: RADII.md, borderWidth: BORDER.hair, borderColor: COLOR.border.default,
    padding: SPACE.md,
  },
});
