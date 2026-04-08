import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Share, Modal, ActivityIndicator,
  ScrollView, TextInput, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GLASS } from '../theme/glassTheme';
import { authFetch } from '../utils/api';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import { useWS } from '../contexts/WebSocketContext';
import { t } from '../utils/i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

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

type NewTitle = {
  level: number;
  title: string;
  category: string;
};

type QuizQuestion = {
  id: string;
  question_text: string;
  options: string[];
  correct_option: number;
};

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
    asyncChallenge: string; challengeOpponent: string;
  }>();
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
  const [newTitle, setNewTitle] = useState<NewTitle | null>(null);
  const [newLevel, setNewLevel] = useState<number | null>(null);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [submitting, setSubmitting] = useState(true);
  const [playerPseudo, setPlayerPseudo] = useState(t('game.player'));

  // Report question states
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
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

  // Title celebration anims
  const titleScale = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleGlow = useRef(new Animated.Value(0)).current;

  // Keep ref in sync to avoid stale closures in WS listeners
  useEffect(() => { rematchStateRef.current = rematchState; }, [rematchState]);

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
    ]).start();

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
    try {
      const userId = params.userId || await AsyncStorage.getItem('duelo_user_id');
      const res = await authFetch(`${API_URL}/api/game/submit-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: userId,
          theme_id: category,
          player_score: pScore,
          opponent_score: oScore,
          opponent_pseudo: params.opponentPseudo,
          opponent_is_bot: params.isBot === 'true',
          correct_count: correctCount,
          opponent_level: parseInt(params.opponentLevel || '1'),
        }),
      });
      if (!res.ok) {
        console.warn(`[submit-v2] ${res.status} - theme_id="${category}"`);
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      if (data.xp_breakdown) {
        setXpBreakdown(data.xp_breakdown);
      }
      if (data.new_title) {
        setNewTitle(data.new_title);
        // Show title celebration after a short delay
        setTimeout(() => {
          setShowTitleModal(true);
          animateTitleCelebration();
        }, 1200);
      }
      if (data.new_level) {
        setNewLevel(data.new_level);
      }
    } catch (e) { console.error(e); }
    setSubmitting(false);
  };

  const animateTitleCelebration = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(titleScale, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Glow loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(titleGlow, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(titleGlow, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  };

  const shareResult = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const categoryName = CATEGORY_NAMES[category || ''] || category;
    const text = won
      ? `${t('results.share_victory')} ${pScore}-${oScore} en ${categoryName} (${correctCount}/7). ${t('results.share_challenge')}`
      : `${t('results.share_intense')} ${pScore}-${oScore} en ${categoryName}. ${t('results.share_beat_me')}`;
    try { await Share.share({ message: text }); } catch (e) { console.error(e); }
  };

  const loadQuizQuestions = async () => {
    try {
      const raw = await AsyncStorage.getItem('duelo_last_quiz_questions');
      if (raw) {
        const parsed = JSON.parse(raw);
        setQuizQuestions(parsed);
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

  const resultGradient: [string, string] = won
    ? ['#00FF9D', '#00C97A']
    : draw
      ? ['#FFD700', '#FFA500']
      : ['#FF3B30', '#CC2D26'];

  const resultIcon = won ? 'trophy' : draw ? 'handshake' : 'arm-flex';

  return (
    <SwipeBackPage>
    <View style={[styles.container, { paddingTop: insets.top }]}>
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

        {/* Result Header */}
        <Animated.View style={[styles.resultHeader, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={resultGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.resultIconCircle}
          >
            <MaterialCommunityIcons name={resultIcon} size={40} color="#FFF" />
          </LinearGradient>
          <Text style={[styles.resultTitle, won ? styles.winText : draw ? styles.drawText : styles.lossText]}>
            {won ? t('results.victory') : draw ? t('results.draw') : t('results.defeat')}
          </Text>
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
        </Animated.View>

        {/* Score Card */}
        <Animated.View style={[styles.scoreCard, { opacity: fadeAnim, transform: [{ translateY: cardSlide }] }]}>
          <LinearGradient
            colors={won ? ['rgba(0,255,157,0.08)', 'rgba(0,255,157,0.02)'] : !draw ? ['rgba(255,59,48,0.08)', 'rgba(255,59,48,0.02)'] : ['rgba(255,215,0,0.08)', 'rgba(255,215,0,0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.scoreCardGradient}
          >
            <View style={styles.scoreCardInner}>
              <View style={styles.playerColumn}>
                <LinearGradient
                  colors={['#8A2BE2', '#6A1FB0']}
                  style={styles.avatarCircle}
                >
                  <Text style={styles.avatarText}>{playerPseudo[0]?.toUpperCase()}</Text>
                </LinearGradient>
                <Text style={styles.playerName}>{playerPseudo}</Text>
                <Text style={[styles.playerScore, won && styles.winScore]}>{pScore}</Text>
              </View>
              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>VS</Text>
                <Text style={styles.categoryBadge}>{CATEGORY_NAMES[category || '']}</Text>
              </View>
              <View style={styles.playerColumn}>
                <LinearGradient
                  colors={['#FF3B30', '#CC2D26']}
                  style={styles.avatarCircle}
                >
                  <Text style={styles.avatarText}>{(params.opponentPseudo || 'B')[0].toUpperCase()}</Text>
                </LinearGradient>
                {params.opponentId ? (
                  <TouchableOpacity onPress={() => router.push(`/player-profile?id=${params.opponentId}`)}>
                    <Text style={[styles.playerName, { textDecorationLine: 'underline' }]}>{params.opponentPseudo?.slice(0, 12)}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.playerName}>{params.opponentPseudo?.slice(0, 12)}</Text>
                )}
                <Text style={[styles.playerScore, !won && !draw && styles.winScore]}>{oScore}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* XP Breakdown */}
        <Animated.View style={[styles.xpCard, { opacity: fadeAnim, transform: [{ translateY: xpSlide }] }]}>
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
                <LinearGradient
                  colors={['#00FFFF', '#8A2BE2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.xpTotalBadge}
                >
                  <Text style={styles.xpTotalValue}>+{xpBreakdown.total} XP</Text>
                </LinearGradient>
              </View>
            </>
          ) : null}
        </Animated.View>

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
                  ? ['#FF3B30', '#CC2D26']
                  : rematchState === 'accepted'
                    ? ['#00FF9D', '#00C97A']
                    : ['#8A2BE2', '#6A1FB0']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.playAgainButton}
            >
              {rematchState === 'waiting' ? (
                <>
                  <ActivityIndicator color="#FFF" size="small" />
                  <Text style={styles.playAgainText}>{t('results.waiting')}</Text>
                </>
              ) : rematchState === 'declined' ? (
                <>
                  <MaterialCommunityIcons name="close-circle" size={18} color="#FFF" />
                  <Text style={styles.playAgainText}>{t('results.declined')}</Text>
                </>
              ) : rematchState === 'accepted' ? (
                <>
                  <MaterialCommunityIcons name="check-circle" size={18} color="#FFF" />
                  <Text style={styles.playAgainText}>{t('results.accepted')}</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="sword-cross" size={18} color="#FFF" />
                  <Text style={styles.playAgainText}>{t('results.rematch')}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity testID="go-home-btn" style={styles.homeButton} onPress={() => router.replace('/(tabs)/play')}>
            <MaterialCommunityIcons name="home" size={18} color="#525252" />
            <Text style={styles.homeText}>{t('results.back_home')}</Text>
          </TouchableOpacity>

          {quizQuestions.length > 0 && (
            <TouchableOpacity testID="report-error-btn" style={styles.reportButton} onPress={openReportModal} activeOpacity={0.7}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FFA500" />
              <Text style={styles.reportButtonText}>{t('results.report_error')}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>

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

      {/* Title Celebration Modal */}
      {newTitle && (
        <Modal visible={showTitleModal} transparent animationType="none" onRequestClose={() => setShowTitleModal(false)}>
          <View style={styles.celebrationOverlay}>
            <Animated.View style={[styles.celebrationContent, {
              opacity: titleOpacity,
              transform: [{ scale: titleScale }],
            }]}>
              <LinearGradient
                colors={['#FFD700', '#FFA500']}
                style={styles.celebrationStarCircle}
              >
                <MaterialCommunityIcons name="star-four-points" size={48} color="#FFF" />
              </LinearGradient>
              <Text style={styles.celebrationHeader}>{t('results.new_title_unlocked')}</Text>
              <Animated.Text style={[styles.celebrationTitle, { opacity: titleGlow }]}>
                {newTitle.title}
              </Animated.Text>
              <View style={styles.celebrationCategory}>
                <MaterialCommunityIcons
                  name="help-circle"
                  size={18}
                  color="#A3A3A3"
                />
                <Text style={styles.celebrationCatText}>
                  {CATEGORY_NAMES[newTitle.category]} - {t('results.level_up')} {newTitle.level}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowTitleModal(false)}
                activeOpacity={0.8}
                style={styles.celebrationBtnTouchable}
              >
                <LinearGradient
                  colors={['#8A2BE2', '#6A1FB0']}
                  style={styles.celebrationBtn}
                >
                  <Text style={styles.celebrationBtnText}>{t('results.continue')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      )}
    </View>
    </SwipeBackPage>
  );
}

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
  resultIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
  resultTitle: { fontSize: 32, fontWeight: '900', letterSpacing: 4 },
  winText: { color: '#00FF9D' },
  drawText: { color: '#FFD700' },
  lossText: { color: '#FF3B30' },
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
  // Score Card
  scoreCard: {
    borderRadius: GLASS.radiusLg, overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS.borderCyan, marginBottom: 16,
  },
  scoreCardGradient: {
    padding: 20, borderRadius: GLASS.radiusLg,
  },
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
    backgroundColor: GLASS.bg, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16,
  },
  xpTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  xpTitle: { fontSize: 11, fontWeight: '800', color: '#525252', letterSpacing: 3 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  xpLabelRow: { flexDirection: 'row', alignItems: 'center' },
  xpLabel: { color: '#A3A3A3', fontSize: 14, fontWeight: '500' },
  xpValue: { color: '#00FF9D', fontSize: 14, fontWeight: '700' },
  xpGold: { color: '#FFD700' },
  xpCyan: { color: '#00FFFF' },
  xpPurple: { color: '#8A2BE2' },
  xpOrange: { color: '#FF6B35' },
  xpDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 },
  xpTotalLabel: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  xpTotalBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  xpTotalValue: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  // Actions
  actions: { gap: 10 },
  shareButton: {
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(0,255,255,0.2)',
  },
  shareGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: 14,
  },
  shareText: { color: '#00FFFF', fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  playAgainTouchable: { borderRadius: 14, overflow: 'hidden' },
  playAgainButton: {
    borderRadius: 14, padding: 16, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12,
  },
  playAgainText: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  homeButton: {
    padding: 12, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  homeText: { color: '#525252', fontSize: 14, fontWeight: '600' },
  // Report Button
  reportButton: {
    marginTop: 6, padding: 12, alignItems: 'center', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,165,0,0.2)', backgroundColor: 'rgba(255,165,0,0.05)',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  reportButtonText: { color: '#FFA500', fontSize: 12, fontWeight: '600' },
  // Celebration Modal
  celebrationOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  celebrationContent: { alignItems: 'center', width: '100%' },
  celebrationStarCircle: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 16,
  },
  celebrationHeader: {
    fontSize: 14, fontWeight: '800', color: '#FFD700', letterSpacing: 4, marginBottom: 12,
  },
  celebrationTitle: {
    fontSize: 32, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 16,
    textShadowColor: '#8A2BE2', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
  },
  celebrationCategory: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32,
    backgroundColor: GLASS.bgLight, borderRadius: GLASS.radiusLg, paddingHorizontal: 16, paddingVertical: 8,
  },
  celebrationCatText: { color: '#A3A3A3', fontSize: 14, fontWeight: '600' },
  celebrationBtnTouchable: { borderRadius: 16, overflow: 'hidden' },
  celebrationBtn: {
    borderRadius: 16, paddingHorizontal: 48, paddingVertical: 16,
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 16,
  },
  celebrationBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 3 },
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
});
