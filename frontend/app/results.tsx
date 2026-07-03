import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Share, Modal, ActivityIndicator,
  ScrollView, TextInput, KeyboardAvoidingView, Platform, Keyboard, Dimensions,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GLASS } from '../theme/glassTheme';
import { authFetch } from '../utils/api';
import { playSound } from '../utils/sounds';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import { useWS } from '../contexts/WebSocketContext';
import { t } from '../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORY_NAMES: Record<string, string> = {};

const CATEGORY_ICONS: Record<string, string> = {};

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

const REPORT_REASONS = [
  { id: 'wrong_answer', labelKey: 'report.reason_wrong_answer', icon: 'close-circle' as const },
  { id: 'unclear_question', labelKey: 'report.reason_unclear', icon: 'help-circle' as const },
  { id: 'typo', labelKey: 'report.reason_typo', icon: 'pencil' as const },
  { id: 'outdated', labelKey: 'report.reason_outdated', icon: 'calendar-clock' as const },
  { id: 'other', labelKey: 'report.reason_other', icon: 'message-text' as const },
];

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [submitError, setSubmitError] = useState<'auth' | 'network' | null>(null);
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
      on('rematch_accepted', () => {
        setRematchState('accepted');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          if (hasNavigatedRef.current) return;
          hasNavigatedRef.current = true;
          router.replace(`/matchmaking?category=${category}&rematch=true`);
        }, 600);
      }),
      on('rematch_declined', () => {
        setRematchState('declined');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => {
          if (hasNavigatedRef.current) return;
          hasNavigatedRef.current = true;
          router.replace(`/matchmaking?category=${category}`);
        }, 2000);
      }),
      on('rematch_expired', () => {
        if (rematchStateRef.current === 'waiting') {
          setRematchState('declined');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setTimeout(() => {
            if (hasNavigatedRef.current) return;
            hasNavigatedRef.current = true;
            router.replace(`/matchmaking?category=${category}`);
          }, 2000);
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
      setTimeout(() => {
        if (hasNavigatedRef.current) return;
        hasNavigatedRef.current = true;
        router.replace(`/matchmaking?category=${category}`); // #37 — replace not push
      }, 1500);
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
        setSubmitError(res && (res.status === 401 || res.status === 403) ? 'auth' : 'network');
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
    } catch (e) { console.error(e); setSubmitError('network'); }
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
      ? `🏆 ${t('results.share_victory')} ${pScore}-${oScore} en ${categoryName} (${correctCount}/7)${xpPart}${levelPart}. ${t('results.share_challenge')} #Duelo`
      : `⚔️ ${t('results.share_intense')} ${pScore}-${oScore} en ${categoryName}${xpPart}. ${t('results.share_beat_me')} #Duelo`;
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

  const playAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (rematchState === 'waiting') return;

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
            router.replace(`/matchmaking?category=${category}&rematch=true`);
          }, 800);
        } else {
          setRematchState('declined');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setTimeout(() => {
            router.replace(`/matchmaking?category=${category}`);
          }, 2000);
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

  // Fond teinté selon le résultat : or/feu = victoire, violet = défaite, cyan×violet = égalité
  const bgTint: [string, string, string] = won
    ? ['rgba(255,181,71,0.26)', 'rgba(255,107,44,0.10)', '#050510']
    : draw
      ? ['rgba(0,229,255,0.16)', 'rgba(179,102,255,0.10)', '#050510']
      : ['rgba(179,102,255,0.18)', '#151028', '#050510'];

  // Near-miss: lost (or drew) by 1 point and has at least one missed question
  const scoreGap = oScore - pScore;
  const isNearMiss = !won && scoreGap >= 0 && scoreGap <= 1 && playerAnswers.length > 0;

  // Missed questions (player's selected answer differs from correct_option)
  const missedQuestions = quizQuestions
    .map((q, i) => ({ q, i, playerAnswer: playerAnswers[i] ?? -1 }))
    .filter(({ q, playerAnswer }) => playerAnswer !== q.correct_option);

  return (
    <SwipeBackPage>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={bgTint} locations={[0, 0.32, 0.7]} style={StyleSheet.absoluteFill} />
      <DueloHeader />
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/accueil')} style={styles.backCircle} activeOpacity={0.6}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#FFF" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Async challenge banner */}
        {isAsyncChallenge && (
          <View style={styles.asyncBanner}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#BF5FFF" />
            <View style={{ flex: 1 }}>
              <Text style={styles.asyncBannerTitle}>{t('challenge.async_saved')}</Text>
              {challengeOpponentName ? (
                <Text style={styles.asyncBannerSub}>
                  {challengeOpponentName} {t('challenge.async_will_play')}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Adversaire parti — bandeau forfait (écran 29) */}
        {opponentLeft && (
          <View style={styles.forfeitBanner}>
            <Text style={styles.forfeitEyebrow}>◆ {t('results.forfeit_eyebrow')}</Text>
            <Text style={styles.forfeitTitle}>
              {t('results.forfeit_title', { name: params.opponentPseudo || t('game.opponent') })}
            </Text>
            <Text style={styles.forfeitBody}>{t('results.forfeit_body')}</Text>
            <View style={styles.forfeitChip}>
              <MaterialCommunityIcons name="trophy" size={16} color="#32E7A3" />
              <Text style={styles.forfeitChipText}>{t('results.forfeit_chip')}</Text>
            </View>
          </View>
        )}

        {/* Result Header */}
        <Animated.View style={[styles.resultHeader, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          {correctCount >= 7 && (
            <View style={styles.flawlessPill}>
              <MaterialCommunityIcons name="star-four-points" size={12} color="#050510" />
              <Text style={styles.flawlessPillText}>FLAWLESS</Text>
            </View>
          )}
          {/* Taille calculée selon la longueur (adjustsFontSizeToFit faisait
              disparaître le texte à la fin de l'animation scale sur Android) */}
          {(() => {
            const label = won ? t('results.victory') : draw ? t('results.draw') : t('results.defeat');
            const size = draw ? 48 : label.length > 10 ? 40 : label.length > 8 ? 48 : 60;
            return (
              <Text
                style={[
                  styles.resultTitle,
                  won ? styles.winText : draw ? styles.drawText : styles.lossText,
                  { fontSize: size, lineHeight: size + 6 },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            );
          })()}
          <LinearGradient
            colors={['rgba(138,43,226,0.25)', 'rgba(0,255,255,0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.correctBadgeGradient}
          >
            <MaterialCommunityIcons name="check-circle" size={14} color="#00FF9D" />
            <Text style={styles.correctBadge}>{correctCount}/7 {t('results.correct_answers')}</Text>
          </LinearGradient>
          {newLevel && (
            <LinearGradient
              colors={['rgba(138,43,226,0.3)', 'rgba(138,43,226,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.levelUpBadge}
            >
              <MaterialCommunityIcons name="arrow-up-bold" size={16} color="#8A2BE2" />
              <Text style={styles.levelUpText}>{t('results.level_up')} {newLevel} !</Text>
            </LinearGradient>
          )}
          {isNearMiss && (
            <LinearGradient
              colors={['rgba(255,159,10,0.28)', 'rgba(255,107,53,0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nearMissBadge}
            >
              <MaterialCommunityIcons name="fire" size={16} color="#FF9F0A" />
              <Text style={styles.nearMissText}>{t('results.near_miss')}</Text>
            </LinearGradient>
          )}
        </Animated.View>

        {/* Score Card */}
        <Animated.View style={[styles.scoreCard, { opacity: fadeAnim, transform: [{ translateY: cardSlide }] }]}>
          <View style={styles.scoreCardDuo}>
            {/* Player half */}
            <View style={[styles.scoreHalfCard, won || draw ? styles.scoreHalfCyan : styles.scoreHalfDim]}>
              <LinearGradient
                colors={won || draw ? ['rgba(0,229,255,0.30)', 'rgba(0,229,255,0.06)'] : ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.scoreHalfAvatar, { borderColor: won || draw ? 'rgba(0,229,255,0.55)' : 'rgba(0,229,255,0.2)' }]}>
                <Text style={styles.scoreHalfAvatarText}>{playerPseudo[0]?.toUpperCase()}</Text>
              </View>
              <Text style={styles.scoreHalfName} numberOfLines={1}>{playerPseudo}</Text>
              <Text style={styles.scoreHalfScore}>{pScore}</Text>
              {won && <Text style={[styles.scoreHalfBadge, { color: '#00E5FF' }]}>VAINQUEUR</Text>}
            </View>

            {/* Séparateur VS / = */}
            <View style={styles.scoreVsWrap}>
              {draw
                ? <Text style={styles.scoreEq}>=</Text>
                : <Text style={styles.scoreVs}>VS</Text>}
            </View>

            {/* Opponent half */}
            <View style={[styles.scoreHalfCard, !won ? styles.scoreHalfViolet : styles.scoreHalfDim]}>
              <LinearGradient
                colors={!won ? ['rgba(179,102,255,0.30)', 'rgba(179,102,255,0.06)'] : ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.scoreHalfAvatar, { borderColor: !won ? 'rgba(179,102,255,0.55)' : 'rgba(179,102,255,0.2)' }]}>
                <Text style={styles.scoreHalfAvatarText}>{(params.opponentPseudo || 'B')[0].toUpperCase()}</Text>
              </View>
              {params.opponentId ? (
                <TouchableOpacity onPress={() => router.push(`/player-profile?id=${params.opponentId}`)}>
                  <Text style={[styles.scoreHalfName, { textDecorationLine: 'underline' }]} numberOfLines={1}>
                    {params.opponentPseudo?.slice(0, 12)}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.scoreHalfName} numberOfLines={1}>{params.opponentPseudo?.slice(0, 12)}</Text>
              )}
              <Text style={styles.scoreHalfScore}>{oScore}</Text>
              {!won && !draw && <Text style={[styles.scoreHalfBadge, { color: '#B366FF' }]}>VAINQUEUR</Text>}
            </View>
          </View>
        </Animated.View>

        {/* XP Breakdown */}
        <Animated.View style={[styles.xpCard, won && styles.xpCardWin, { opacity: fadeAnim, transform: [{ translateY: xpSlide }] }]}>
          {submitting ? (
            <ActivityIndicator color="#8A2BE2" />
          ) : xpBreakdown ? (
            <>
              <View style={styles.xpTitleRow}>
                <MaterialCommunityIcons name="lightning-bolt" size={14} color="#525252" />
                <Text style={styles.xpTitle}>{t('results.xp_title')}</Text>
              </View>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>{t('results.base_score')}</Text>
                <Text style={styles.xpValue}>+{xpBreakdown.base}</Text>
              </View>
              {xpBreakdown.victory > 0 && (
                <View style={styles.xpRow}>
                  <View style={styles.xpLabelRow}>
                    <MaterialCommunityIcons name="trophy" size={14} color="#FFD700" />
                    <Text style={styles.xpLabel}>{t('results.victory_bonus')}</Text>
                  </View>
                  <Text style={[styles.xpValue, styles.xpGold]}>+{xpBreakdown.victory}</Text>
                </View>
              )}
              {xpBreakdown.perfection > 0 && (
                <View style={styles.xpRow}>
                  <View style={styles.xpLabelRow}>
                    <MaterialCommunityIcons name="star" size={14} color="#00FFFF" />
                    <Text style={styles.xpLabel}>{t('results.perfection_bonus')}</Text>
                  </View>
                  <Text style={[styles.xpValue, styles.xpCyan]}>+{xpBreakdown.perfection}</Text>
                </View>
              )}
              {xpBreakdown.giant_slayer > 0 && (
                <View style={styles.xpRow}>
                  <View style={styles.xpLabelRow}>
                    <MaterialCommunityIcons name="sword-cross" size={14} color="#8A2BE2" />
                    <Text style={styles.xpLabel}>{t('results.giant_slayer')}</Text>
                  </View>
                  <Text style={[styles.xpValue, styles.xpPurple]}>+{xpBreakdown.giant_slayer}</Text>
                </View>
              )}
              {xpBreakdown.streak > 0 && (
                <View style={styles.xpRow}>
                  <View style={styles.xpLabelRow}>
                    <MaterialCommunityIcons name="fire" size={14} color="#FF6B35" />
                    <Text style={styles.xpLabel}>{t('results.streak_bonus')}</Text>
                  </View>
                  <Text style={[styles.xpValue, styles.xpOrange]}>+{xpBreakdown.streak}</Text>
                </View>
              )}
              <View style={styles.xpDivider} />
              <View style={styles.xpRow}>
                <Text style={styles.xpTotalLabel}>{t('results.total')}</Text>
                <Text style={styles.xpTotalValue}>+{displayXp} XP</Text>
              </View>
            </>
          ) : submitError ? (
            /* Échec d'enregistrement VISIBLE — plus de score perdu en silence */
            <View style={styles.submitErrorWrap}>
              <MaterialCommunityIcons
                name={submitError === 'auth' ? 'account-alert' : 'wifi-off'}
                size={22} color="#FF3D5E"
              />
              <Text style={styles.submitErrorText}>
                {submitError === 'auth' ? t('results.submit_error_auth') : t('results.submit_error_network')}
              </Text>
              {submitError === 'network' && (
                <TouchableOpacity style={styles.submitRetryBtn} onPress={submitMatch} activeOpacity={0.8}>
                  <Text style={styles.submitRetryText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </Animated.View>

        {/* Review missed questions */}
        {missedQuestions.length > 0 && (
          <Animated.View style={[styles.reviewCard, { opacity: fadeAnim }]}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setReviewExpanded(v => !v);
              }}
              activeOpacity={0.7}
              style={styles.reviewHeader}
            >
              <MaterialCommunityIcons name="book-open-variant" size={18} color="#00FFFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewTitle}>{t('results.review_title')}</Text>
                <Text style={styles.reviewSub}>
                  {t('results.review_sub', { n: String(missedQuestions.length) })}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={reviewExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#A3A3A3"
              />
            </TouchableOpacity>
            {reviewExpanded && (
              <View style={styles.reviewList}>
                {missedQuestions.map(({ q, i, playerAnswer }) => {
                  const correctText = q.options[q.correct_option];
                  const yourText = playerAnswer >= 0 ? q.options[playerAnswer] : null;
                  return (
                    <View key={q.id || i} style={styles.reviewItem}>
                      <Text style={styles.reviewQuestion}>{q.question_text}</Text>
                      {yourText && (
                        <View style={styles.reviewAnswerRow}>
                          <MaterialCommunityIcons name="close-circle" size={14} color="#FF3B30" />
                          <Text style={styles.reviewWrongText} numberOfLines={2}>{yourText}</Text>
                        </View>
                      )}
                      {!yourText && (
                        <View style={styles.reviewAnswerRow}>
                          <MaterialCommunityIcons name="timer-off" size={14} color="#A3A3A3" />
                          <Text style={styles.reviewTimeoutText}>{t('results.review_timeout')}</Text>
                        </View>
                      )}
                      <View style={styles.reviewAnswerRow}>
                        <MaterialCommunityIcons name="check-circle" size={14} color="#00FF9D" />
                        <Text style={styles.reviewCorrectText} numberOfLines={2}>{correctText}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Animated.View>
        )}

        {/* Actions */}
        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
          <TouchableOpacity testID="share-result-btn" style={styles.shareButton} onPress={shareResult} activeOpacity={0.8}>
            <LinearGradient
              colors={['rgba(0,255,255,0.12)', 'rgba(0,255,255,0.03)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shareGradient}
            >
              <MaterialCommunityIcons name="share-variant" size={18} color="#00FFFF" />
              <Text style={styles.shareText}>{t('results.challenge_friend')}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.actionRow}>
            <TouchableOpacity testID="go-home-btn" style={styles.homeButton} onPress={() => router.replace('/(tabs)/play')}>
              <Text style={styles.homeText}>{t('results.back_home')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="play-again-btn"
              onPress={playAgain}
              activeOpacity={0.8}
              style={styles.playAgainTouchable}
              disabled={rematchState === 'waiting' || rematchState === 'accepted'}
            >
              <LinearGradient
                colors={
                  rematchState === 'declined'
                    ? ['#FF3D5E', '#CC2D26']
                    : rematchState === 'accepted'
                      ? ['#32E7A3', '#00C97A']
                      : ['#00E5FF', '#B366FF']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.playAgainButton}
              >
                {rematchState === 'waiting' ? (
                  <>
                    <ActivityIndicator color="#050510" size="small" />
                    <Text style={styles.playAgainText}>{t('results.waiting')}</Text>
                  </>
                ) : rematchState === 'declined' ? (
                  <>
                    <MaterialCommunityIcons name="close-circle" size={18} color="#FFF" />
                    <Text style={[styles.playAgainText, { color: '#FFF' }]}>{t('results.declined')}</Text>
                  </>
                ) : rematchState === 'accepted' ? (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={18} color="#050510" />
                    <Text style={styles.playAgainText}>{t('results.accepted')}</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="sword-cross" size={18} color="#050510" />
                    <Text style={styles.playAgainText}>{t('results.rematch')}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {quizQuestions.length > 0 && (
            <TouchableOpacity testID="report-error-btn" style={styles.reportButton} onPress={openReportModal} activeOpacity={0.7}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FFA500" />
              <Text style={styles.reportButtonText}>{t('results.report_error')}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>

      {/* Unified Rewards Modal (Duolingo-style) */}
      <Modal visible={showRewardsModal} transparent animationType="fade" onRequestClose={closeRewardsModal}>
        <View style={rewardsStyles.overlay}>
          <View style={rewardsStyles.card}>
            <Text style={rewardsStyles.header}>{t('results.rewards_title')}</Text>
            <ScrollView style={{ maxHeight: 420, width: '100%' }} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
              {rewards.map((r, i) => (
                <RewardRow
                  key={`${r.type}-${i}`}
                  reward={r}
                  delay={i * 500}
                  streakRestored={streakRestored}
                  adWatching={adWatching}
                  adCountdown={adCountdown}
                  onWatchAd={watchAdAndRestoreStreak}
                />
              ))}
            </ScrollView>
            <RewardContinueBtn delay={rewards.length * 500 + 200} onPress={closeRewardsModal} />
          </View>
          {rewards.some(r => r.type === 'level' || r.type === 'title') && (
            <ConfettiCannon
              count={120}
              origin={{ x: SCREEN_WIDTH / 2, y: -10 }}
              autoStart
              fadeOut
              explosionSpeed={350}
              fallSpeed={2800}
              colors={['#FFD700', '#00FF9D', '#8A2BE2', '#00E5FF', '#FF3E9D']}
            />
          )}
        </View>
      </Modal>

      {/* Report Question Modal */}
      <Modal visible={reportModalVisible} transparent animationType="slide" onRequestClose={() => setReportModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.reportOverlay}>
            <View style={styles.reportModal}>
              {/* Header */}
              <View style={styles.reportHeader}>
                <View style={styles.reportHeaderLeft}>
                  {reportSuccess ? (
                    <MaterialCommunityIcons name="check-circle" size={20} color="#00FF9D" />
                  ) : reportStep === 'select' ? (
                    <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#FFA500" />
                  ) : (
                    <MaterialCommunityIcons name="pencil-box-outline" size={20} color="#00FFFF" />
                  )}
                  <Text style={styles.reportHeaderText}>
                    {reportSuccess ? t('report.thanks') : reportStep === 'select' ? t('report.title') : t('report.details')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setReportModalVisible(false)} style={styles.reportClose}>
                  <MaterialCommunityIcons name="close" size={18} color="#A3A3A3" />
                </TouchableOpacity>
              </View>

              {reportSuccess ? (
                /* Success State */
                <View style={styles.reportSuccessContainer}>
                  <LinearGradient
                    colors={['#00FF9D', '#00C97A']}
                    style={styles.reportSuccessIconCircle}
                  >
                    <MaterialCommunityIcons name="check-bold" size={36} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.reportSuccessTitle}>{t('report.sent')}</Text>
                  <Text style={styles.reportSuccessDesc}>
                    {t('report.thanks_desc')}
                  </Text>
                  <TouchableOpacity style={styles.reportSuccessBtn} onPress={() => setReportModalVisible(false)} activeOpacity={0.8}>
                    <LinearGradient
                      colors={['#8A2BE2', '#6A1FB0']}
                      style={styles.reportSuccessBtnGradient}
                    >
                      <Text style={styles.reportSuccessBtnText}>{t('report.close')}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : reportStep === 'select' ? (
                /* Step 1: Select Question */
                <ScrollView style={styles.reportScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.reportSubtitle}>{t('report.which_question')}</Text>
                  {quizQuestions.map((q, idx) => (
                    <TouchableOpacity
                      key={q.id || idx.toString()}
                      style={styles.reportQuestionItem}
                      onPress={() => selectQuestionForReport(q)}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={['rgba(138,43,226,0.3)', 'rgba(138,43,226,0.15)']}
                        style={styles.reportQuestionNumber}
                      >
                        <Text style={styles.reportQuestionNumberText}>{idx + 1}</Text>
                      </LinearGradient>
                      <Text style={styles.reportQuestionText} numberOfLines={2}>
                        {q.question_text}
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={20} color="#525252" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                /* Step 2: Reason + Description */
                <ScrollView style={styles.reportScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Selected question preview */}
                  <View style={styles.reportSelectedPreview}>
                    <Text style={styles.reportSelectedLabel}>{t('report.selected_question')}</Text>
                    <Text style={styles.reportSelectedText} numberOfLines={2}>{selectedQuestion?.question_text}</Text>
                  </View>

                  <Text style={styles.reportSubtitle}>{t('report.error_type')}</Text>
                  {REPORT_REASONS.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.reportReasonItem, selectedReason === r.id && styles.reportReasonSelected]}
                      onPress={() => { setSelectedReason(r.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name={r.icon} size={18} color={selectedReason === r.id ? '#00FFFF' : '#A3A3A3'} style={{ marginRight: 12 }} />
                      <Text style={[styles.reportReasonLabel, selectedReason === r.id && styles.reportReasonLabelSelected]}>
                        {t(r.labelKey)}
                      </Text>
                      {selectedReason === r.id && <MaterialCommunityIcons name="check-circle" size={18} color="#00FFFF" />}
                    </TouchableOpacity>
                  ))}

                  <Text style={[styles.reportSubtitle, { marginTop: 16 }]}>{t('report.description_optional')}</Text>
                  <TextInput
                    style={styles.reportInput}
                    placeholder={t('report.describe_error')}
                    placeholderTextColor="#525252"
                    value={reportDescription}
                    onChangeText={setReportDescription}
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                  />
                  <Text style={styles.reportCharCount}>{reportDescription.length}/500</Text>

                  {reportError && (
                    <View style={styles.reportErrorBanner}>
                      <MaterialCommunityIcons name="alert-circle" size={16} color="#FF3B30" />
                      <Text style={styles.reportErrorText}>{reportError}</Text>
                    </View>
                  )}

                  <View style={styles.reportActions}>
                    <TouchableOpacity style={styles.reportBackBtn} onPress={() => setReportStep('select')} activeOpacity={0.7}>
                      <MaterialCommunityIcons name="chevron-left" size={18} color="#A3A3A3" />
                      <Text style={styles.reportBackText}>{t('common.back')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reportSubmitBtn, (!selectedReason || reportSubmitting) && styles.reportSubmitDisabled]}
                      onPress={submitReport}
                      disabled={!selectedReason || reportSubmitting}
                      activeOpacity={0.8}
                    >
                      {reportSubmitting ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <LinearGradient
                          colors={(!selectedReason || reportSubmitting) ? ['rgba(255,165,0,0.3)', 'rgba(255,165,0,0.2)'] : ['#FFA500', '#E69500']}
                          style={styles.reportSubmitGradient}
                        >
                          <Text style={styles.reportSubmitText}>{t('report.send')}</Text>
                        </LinearGradient>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confetti — victoire */}
      {won && (
        <ConfettiCannon
          ref={confettiRef}
          count={140}
          origin={{ x: SCREEN_WIDTH / 2, y: -10 }}
          autoStart={false}
          fadeOut={true}
          explosionSpeed={350}
          fallSpeed={2800}
          colors={['#FFD700', '#00FF9D', '#8A2BE2', '#00E5FF', '#FF3E9D']}
        />
      )}

    </View>
    </SwipeBackPage>
  );
}

type RewardRowProps = {
  reward: Reward;
  delay: number;
  streakRestored: boolean;
  adWatching: boolean;
  adCountdown: number;
  onWatchAd: () => void;
};

function RewardRow({ reward, delay, streakRestored, adWatching, adCountdown, onWatchAd }: RewardRowProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, tension: 80, friction: 9, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const content = (() => {
    switch (reward.type) {
      case 'level':
        return (
          <>
            <LinearGradient colors={['#8A2BE2', '#A855F7']} style={rewardsStyles.iconCircle}>
              <MaterialCommunityIcons name="arrow-up-bold-circle" size={26} color="#FFF" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={rewardsStyles.rowLabel}>{t('results.new_level_reached')}</Text>
              <Text style={rewardsStyles.rowValueBig}>{t('results.level_up')} {reward.level}</Text>
            </View>
          </>
        );
      case 'title':
        return (
          <>
            <LinearGradient colors={['#FFD700', '#FFA500']} style={rewardsStyles.iconCircle}>
              <MaterialCommunityIcons name="star-four-points" size={26} color="#FFF" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={rewardsStyles.rowLabel}>{t('results.new_title_unlocked')}</Text>
              <Text style={rewardsStyles.rowValueBig}>{reward.title}</Text>
              <Text style={rewardsStyles.rowSub}>{t('results.level_up')} {reward.level}</Text>
            </View>
          </>
        );
      case 'achievement':
        return (
          <>
            <View style={[rewardsStyles.iconCircle, { backgroundColor: 'rgba(191,95,255,0.18)' }]}>
              <Text style={{ fontSize: 24 }}>{reward.icon || '🏅'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={rewardsStyles.rowLabel}>{t('results.achievement_unlocked')}</Text>
              <Text style={rewardsStyles.rowValue}>{reward.name}</Text>
              <Text style={rewardsStyles.rowSub}>{reward.description}</Text>
            </View>
          </>
        );
      case 'shield':
        return (
          <>
            <View style={[rewardsStyles.iconCircle, { backgroundColor: 'rgba(255,107,53,0.18)' }]}>
              <Text style={{ fontSize: 24 }}>{streakRestored ? '🔥' : adWatching ? '📺' : '🛡️'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {streakRestored ? (
                <>
                  <Text style={rewardsStyles.rowLabel}>{t('results.streak_restored')}</Text>
                  <Text style={rewardsStyles.rowValue}>{t('results.streak_restored_sub', { n: String(reward.streakBefore) })}</Text>
                </>
              ) : adWatching ? (
                <>
                  <Text style={rewardsStyles.rowLabel}>{t('results.ad_watching')}</Text>
                  <Text style={rewardsStyles.rowValueBig}>{adCountdown}</Text>
                </>
              ) : (
                <>
                  <Text style={rewardsStyles.rowLabel}>{t('results.shield_title', { n: String(reward.streakBefore) })}</Text>
                  <Text style={rewardsStyles.rowSub}>{t('results.shield_sub')}</Text>
                  <TouchableOpacity style={rewardsStyles.adBtn} onPress={onWatchAd} activeOpacity={0.8}>
                    <LinearGradient colors={['#FFD700', '#FF9F0A']} style={rewardsStyles.adBtnGrad}>
                      <MaterialCommunityIcons name="play-circle" size={16} color="#000" />
                      <Text style={rewardsStyles.adBtnText}>{t('results.watch_ad')}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        );
    }
  })();

  return (
    <Animated.View style={[rewardsStyles.row, { opacity, transform: [{ translateY }] }]}>
      {content}
    </Animated.View>
  );
}

function RewardContinueBtn({ delay, onPress }: { delay: number; onPress: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, tension: 80, friction: 9, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], width: '100%', marginTop: 16 }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={rewardsStyles.continueBtnTouchable}>
        <LinearGradient colors={['#8A2BE2', '#6A1FB0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={rewardsStyles.continueBtn}>
          <Text style={rewardsStyles.continueBtnText}>{t('results.continue')}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const rewardsStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#10102A', borderRadius: 24, padding: 24, width: '100%',
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.35)', alignItems: 'center',
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 20,
  },
  header: {
    color: '#FFD700', fontSize: 13, fontWeight: '900', letterSpacing: 4,
    marginBottom: 18, textAlign: 'center',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10,
    paddingHorizontal: 4, width: '100%',
  },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  rowLabel: { color: '#A3A3A3', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  rowValue: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  rowValueBig: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  rowSub: { color: '#A3A3A3', fontSize: 12, fontWeight: '500', marginTop: 2 },
  adBtn: { marginTop: 8, borderRadius: 12, overflow: 'hidden', alignSelf: 'flex-start' },
  adBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 14, gap: 6 },
  adBtnText: { color: '#000', fontSize: 13, fontWeight: '800' },
  continueBtnTouchable: { borderRadius: 14, overflow: 'hidden' },
  continueBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 12,
  },
  continueBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 3 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  subHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
  },
  asyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(191,95,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(191,95,255,0.25)',
  },
  asyncBannerTitle: {
    color: '#BF5FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  asyncBannerSub: {
    color: 'rgba(191,95,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  backCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 24 },
  // Result Header
  resultHeader: { alignItems: 'center', marginBottom: 20 },
  resultTitle: { fontSize: 60, fontWeight: '900', letterSpacing: -2, lineHeight: 66, fontFamily: 'SpaceGrotesk_700Bold' },
  winText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(255,181,71,0.9)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24,
  },
  drawText: { fontFamily: 'Fraunces_500Medium_Italic', color: '#FFFFFF', fontSize: 48, letterSpacing: -1 },
  lossText: { color: 'rgba(255,255,255,0.85)' },
  // Échec d'enregistrement
  submitErrorWrap: { alignItems: 'center', gap: 8, paddingVertical: 6 },
  submitErrorText: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center',
    fontFamily: 'SpaceGrotesk_500Medium', lineHeight: 18,
  },
  submitRetryBtn: {
    marginTop: 4, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(255,61,94,0.12)', borderWidth: 1, borderColor: 'rgba(255,61,94,0.40)',
  },
  submitRetryText: { color: '#FF3D5E', fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },

  forfeitBanner: {
    alignItems: 'center', marginBottom: 18, paddingHorizontal: 8,
  },
  forfeitEyebrow: {
    fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, letterSpacing: 2.5, color: '#FFB547',
  },
  forfeitTitle: {
    fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, letterSpacing: -0.5,
    color: '#FFFFFF', marginTop: 6, textAlign: 'center',
  },
  forfeitBody: {
    fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, lineHeight: 20,
    color: 'rgba(255,255,255,0.60)', maxWidth: 280, marginTop: 8, textAlign: 'center',
  },
  forfeitChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12,
    backgroundColor: 'rgba(50,231,163,0.13)', borderWidth: 1, borderColor: 'rgba(50,231,163,0.40)',
  },
  forfeitChipText: {
    fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#32E7A3',
  },
  flawlessPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFB547', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 6, marginBottom: 10,
  },
  flawlessPillText: { color: '#050510', fontSize: 10, fontWeight: '900', letterSpacing: 3, fontFamily: 'SpaceGrotesk_700Bold' },
  correctBadgeGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6,
  },
  correctBadge: { color: '#A3A3A3', fontSize: 14, fontWeight: '600' },
  levelUpBadge: {
    marginTop: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(138,43,226,0.3)',
  },
  levelUpText: { color: '#8A2BE2', fontSize: 14, fontWeight: '800' },
  nearMissBadge: {
    marginTop: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,159,10,0.35)',
  },
  nearMissText: { color: '#FF9F0A', fontSize: 13, fontWeight: '700' },
  // Review missed questions
  reviewCard: {
    backgroundColor: 'rgba(0,255,255,0.04)', borderRadius: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(0,255,255,0.18)', overflow: 'hidden',
  },
  reviewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
  },
  reviewTitle: { color: '#00FFFF', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  reviewSub: { color: '#A3A3A3', fontSize: 12, fontWeight: '500', marginTop: 2 },
  reviewList: {
    paddingHorizontal: 14, paddingBottom: 14, gap: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(0,255,255,0.1)', paddingTop: 10,
  },
  reviewItem: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12, gap: 6,
  },
  reviewQuestion: { color: '#E5E5E5', fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 4 },
  reviewAnswerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewWrongText: { color: '#FF3B30', fontSize: 12, fontWeight: '500', flex: 1, textDecorationLine: 'line-through' },
  reviewTimeoutText: { color: '#A3A3A3', fontSize: 12, fontWeight: '500', fontStyle: 'italic' },
  reviewCorrectText: { color: '#00FF9D', fontSize: 12, fontWeight: '700', flex: 1 },
  // Score Card
  scoreCard: { marginBottom: 16 },
  scoreCardInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  playerColumn: { alignItems: 'center', flex: 1 },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  avatarText: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  playerName: { color: '#A3A3A3', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  playerScore: { fontSize: 28, fontWeight: '900', color: '#FFF' },
  winScore: { color: '#00FF9D' },
  vsContainer: { alignItems: 'center', paddingHorizontal: 10 },
  vsText: { fontSize: 14, fontWeight: '900', color: '#525252' },
  categoryBadge: { fontSize: 9, color: '#525252', fontWeight: '600', textAlign: 'center', marginTop: 2 },
  // XP Card
  xpCard: {
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', marginBottom: 16,
  },
  xpCardWin: { borderColor: 'rgba(255,181,71,0.40)' },
  xpTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  xpTitle: {
    fontSize: 9, fontWeight: '400', color: 'rgba(255,255,255,0.40)',
    letterSpacing: 2, fontFamily: 'JetBrainsMono_400Regular', textTransform: 'uppercase',
  },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  xpLabelRow: { flexDirection: 'row', alignItems: 'center' },
  xpLabel: { color: 'rgba(255,255,255,0.60)', fontSize: 13, fontWeight: '500' },
  xpValue: { color: '#FFF', fontSize: 14, fontWeight: '800', fontFamily: 'SpaceGrotesk_700Bold' },
  xpGold: { color: '#FFB547' },
  xpCyan: { color: '#32E7A3' },
  xpPurple: { color: '#B366FF' },
  xpOrange: { color: '#FF6B2C' },
  xpDivider: { height: 1, backgroundColor: 'rgba(255,181,71,0.30)', marginVertical: 8 },
  xpTotalLabel: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5, fontFamily: 'SpaceGrotesk_700Bold' },
  xpTotalValue: { color: '#FFB547', fontSize: 22, fontWeight: '900', fontFamily: 'SpaceGrotesk_700Bold' },
  // Actions
  actions: { gap: 10 },
  actionRow: { flexDirection: 'row', gap: 8 },
  shareButton: {
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(0,255,255,0.2)',
  },
  shareGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: 14,
  },
  shareText: { color: '#00FFFF', fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  playAgainTouchable: {
    flex: 2, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  playAgainButton: {
    borderRadius: 16, padding: 16, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  playAgainText: {
    color: '#050510', fontSize: 14, fontWeight: '900',
    letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'SpaceGrotesk_700Bold',
  },
  homeButton: {
    flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  homeText: { color: '#FFF', fontSize: 13, fontWeight: '800', fontFamily: 'SpaceGrotesk_700Bold' },
  // Report Button
  reportButton: {
    marginTop: 6, padding: 12, alignItems: 'center', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,165,0,0.2)', backgroundColor: 'rgba(255,165,0,0.05)',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  reportButtonText: { color: '#FFA500', fontSize: 12, fontWeight: '600' },
  // Report Modal
  reportOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end',
  },
  reportModal: {
    backgroundColor: '#0D0D1A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%', minHeight: 300,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: 'rgba(0,255,255,0.15)',
  },
  reportHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  reportHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportHeaderText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  reportClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center',
  },
  reportScroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  reportSubtitle: { color: '#A3A3A3', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  // Question list item
  reportQuestionItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  reportQuestionNumber: {
    width: 28, height: 28, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  reportQuestionNumberText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  reportQuestionText: { flex: 1, color: '#E5E5E5', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  // Selected question preview
  reportSelectedPreview: {
    backgroundColor: 'rgba(138,43,226,0.08)', borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.2)',
  },
  reportSelectedLabel: { color: '#8A2BE2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  reportSelectedText: { color: '#E5E5E5', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  // Reason items
  reportReasonItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  reportReasonSelected: {
    backgroundColor: 'rgba(0,255,255,0.06)', borderColor: 'rgba(0,255,255,0.25)',
  },
  reportReasonLabel: { flex: 1, color: '#A3A3A3', fontSize: 14, fontWeight: '600' },
  reportReasonLabelSelected: { color: '#FFF' },
  // Description input
  reportInput: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', color: '#FFF',
    fontSize: 14, fontWeight: '500', height: 90, textAlignVertical: 'top',
  },
  reportCharCount: { color: '#525252', fontSize: 11, fontWeight: '500', textAlign: 'right', marginTop: 4 },
  // Error banner
  reportErrorBanner: {
    backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 10, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: 'rgba(255,59,48,0.2)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  reportErrorText: { color: '#FF3B30', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  // Action buttons
  reportActions: {
    flexDirection: 'row', gap: 10, marginTop: 20, paddingBottom: 20,
  },
  reportBackBtn: {
    flex: 1, padding: 14, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row', justifyContent: 'center', gap: 4,
  },
  reportBackText: { color: '#A3A3A3', fontSize: 14, fontWeight: '700' },
  reportSubmitBtn: {
    flex: 2, borderRadius: 14, overflow: 'hidden',
  },
  reportSubmitDisabled: { opacity: 0.5 },
  reportSubmitGradient: {
    padding: 14, borderRadius: 14, alignItems: 'center',
  },
  reportSubmitText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  // Success state
  reportSuccessContainer: {
    alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20,
  },
  reportSuccessIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  reportSuccessTitle: { color: '#00FF9D', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  reportSuccessDesc: { color: '#A3A3A3', fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  reportSuccessBtn: { borderRadius: 14, overflow: 'hidden' },
  reportSuccessBtnGradient: {
    borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14,
  },
  reportSuccessBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 2 },

  // Redesigned score card — two side-by-side halves
  scoreCardDuo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreHalfCard: {
    flex: 1, borderRadius: 20, overflow: 'hidden',
    padding: 14, alignItems: 'center', borderWidth: 2,
  },
  scoreHalfCyan: { borderColor: '#00E5FF' },
  scoreHalfViolet: { borderColor: '#B366FF' },
  scoreHalfDim: { borderColor: 'rgba(255,255,255,0.08)', opacity: 0.65 },
  scoreVsWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  scoreVs: { color: '#FFB547', fontSize: 20, fontWeight: '900', fontFamily: 'SpaceGrotesk_700Bold' },
  scoreEq: { color: '#FFB547', fontSize: 26, fontFamily: 'Fraunces_500Medium_Italic' },
  scoreHalfAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, marginBottom: 8,
  },
  scoreHalfAvatarText: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  scoreHalfName: {
    color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700',
    marginBottom: 4, textAlign: 'center',
  },
  scoreHalfScore: { color: '#FFF', fontSize: 38, fontWeight: '900', lineHeight: 44, letterSpacing: -2, fontFamily: 'SpaceGrotesk_700Bold' },
  scoreHalfBadge: {
    fontSize: 9, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold',
    letterSpacing: 1.5, marginTop: 4, textAlign: 'center',
  },
});
