import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
  Platform, UIManager, ActivityIndicator, Easing, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GLASS } from '../theme/glassTheme';
import SwipeBackPage from '../components/SwipeBackPage';
import RoundTimer from '../components/RoundTimer';
import { useWS } from '../contexts/WebSocketContext';
import { authFetch } from '../utils/api';
import { saveScoreWithRetry } from '../utils/pendingScores';
import { t } from '../utils/i18n';
import { preloadSounds, playSound } from '../utils/sounds';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const TIMER_DURATION = 10;
const TOTAL_QUESTIONS = 7;
const MAX_PTS_PER_Q = 20;
const MAX_TOTAL = MAX_PTS_PER_Q * TOTAL_QUESTIONS; // 140

type Question = {
  id: string;
  question_text: string;
  options: string[];
  correct_option: number;
};

// ── Design tokens ──
const CYAN = '#00E5FF';
const VIOLET = '#B366FF';
const GOLD = '#FFB547';
const MINT = '#32E7A3';
const RED = '#FF3D5E';
const OPTION_COLORS = [CYAN, MINT, VIOLET, GOLD];

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category: string; opponentPseudo: string; opponentSeed: string; isBot: string; roomId: string; opponentLevel: string; opponentId: string;
    challenge_id: string; asyncChallenge: string; asyncMode: string;
    botSkill: string; botSpeed: string;
  }>();
  const { send: wsSend, on: wsOn } = useWS();

  const themeId = params.category;
  const isLive = params.roomId && params.isBot !== 'true';
  const isAsyncSolo = params.asyncMode === 'solo';
  const isAsyncReveal = params.asyncMode === 'reveal';
  const isAsync = isAsyncSolo || isAsyncReveal;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [botAnswer, setBotAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState(t('game.player'));
  const [showPending, setShowPending] = useState(true);

  // Loading spinner animation
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  // Score refs to avoid stale closures
  const playerScoreRef = useRef(0);
  const botScoreRef = useRef(0);
  const correctCountRef = useRef(0);
  const opponentLevelRef = useRef(1);
  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);

  // Progress bar state (questions)
  const [completedQuestions, setCompletedQuestions] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLeftRef = useRef(TIMER_DURATION);
  const questionsRef = useRef<Question[]>([]);
  const currentIndexRef = useRef(0);
  const timerAnim = useRef(new Animated.Value(1)).current;
  const questionFade = useRef(new Animated.Value(0)).current;
  const questionSlide = useRef(new Animated.Value(24)).current;
  const userIdRef = useRef<string | null>(null);
  const lastAnswerCorrectRef = useRef(false);

  // Async challenge tracking
  type AnswerRecord = { answer: number; is_correct: boolean; points: number; time_ms: number };
  const playerAnswersHistoryRef = useRef<AnswerRecord[]>([]);
  const p1AnswersRef = useRef<{ answer: number; is_correct: boolean; points: number }[]>([]);

  // Per-question player selections for the results "review missed" feature (all modes)
  const playerSelectionsRef = useRef<Record<number, number>>({});

  // Guards
  const isSubmittingRef = useRef(false);               // #18 double-tap prevention
  const wsAnswerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // #17 WS hang timeout

  // Progress bar animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressPendingOpacity = useRef(new Animated.Value(1)).current;

  // Question slide scale animation
  const questionScaleAnim = useRef(new Animated.Value(0.96)).current;

  // Correct streak streak toast
  const [correctStreak, setCorrectStreak] = useState(0);
  const correctStreakRef = useRef(0);
  const [streakToastVisible, setStreakToastVisible] = useState(false);
  const [streakToastCount, setStreakToastCount] = useState(0);
  const streakToastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    preloadSounds();
    loadPseudo();

    if (isLive) {
      // Live multiplayer: wait for game_start from WebSocket
      // Questions are loaded server-side and pushed to us
    } else {
      // Bot mode: fetch questions via HTTP — guard against missing themeId (#19)
      if (!themeId) {
        setLoading(false);
        setLoadError(t('game.invalid_game') || 'Thème invalide');
        return;
      }
      fetchQuestions();
    }

    // Start loading animation
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true,
      })
    );
    spin.start();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      spin.stop();
      pulse.stop();
    };
  }, []);

  // ── Fetch Player A's answers for reveal mode ──
  useEffect(() => {
    if (!isAsyncReveal || !params.challenge_id) return;
    const fetchP1Answers = async () => {
      try {
        const userId = await AsyncStorage.getItem('duelo_user_id');
        const res = await authFetch(
          `${API_URL}/api/challenges/${params.challenge_id}/p1-answers?user_id=${userId}`
        );
        if (res.ok) {
          const data = await res.json();
          p1AnswersRef.current = data.answers || [];
        }
      } catch (e) { console.error(e); }
    };
    fetchP1Answers();
  }, []);

  // ── Live multiplayer WebSocket listeners ──
  useEffect(() => {
    if (!isLive) return;

    const unsubs = [
      // Server sends game_start with first question
      wsOn('game_start', (msg) => {
        const q = msg.data?.question;
        if (q) {
          // Store total questions count, set first question
          const total = msg.data?.total_questions || TOTAL_QUESTIONS;
          questionsRef.current = [q];
          currentIndexRef.current = 0;
          setQuestions([q]);
          setLoading(false);
          animateQuestion();
          startTimer();
        }
      }),
      // Our answer result
      wsOn('answer_result', (msg) => {
        // #17 clear hang timeout, #18 reset submission guard
        if (wsAnswerTimeoutRef.current) clearTimeout(wsAnswerTimeoutRef.current);
        isSubmittingRef.current = false;

        const { is_correct, points, your_score, opponent_score, question_index } = msg.data || {};
        lastAnswerCorrectRef.current = is_correct;
        playerScoreRef.current = your_score;
        botScoreRef.current = opponent_score;
        setPlayerScore(your_score);
        setBotScore(opponent_score);
        if (is_correct) correctCountRef.current += 1;

        setShowResult(true);
        setShowPending(false);

        const done = question_index + 1;
        setCompletedQuestions(done);
        Animated.timing(progressAnim, {
          toValue: done / TOTAL_QUESTIONS,
          duration: 400,
          useNativeDriver: false,
        }).start();
        Animated.timing(progressPendingOpacity, {
          toValue: 0, duration: 300, useNativeDriver: false,
        }).start();

        Haptics.notificationAsync(
          is_correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
        );
        playSound(is_correct ? 'correct' : 'wrong');
      }),
      // Opponent answered (update their score)
      wsOn('opponent_answered', (msg) => {
        const { your_score, opponent_score } = msg.data || {};
        botScoreRef.current = opponent_score;
        playerScoreRef.current = your_score;
        setBotScore(opponent_score);
        setPlayerScore(your_score);
      }),
      // Next question
      wsOn('next_question', (msg) => {
        const q = msg.data?.question;
        if (q) {
          questionsRef.current = [...questionsRef.current, q];
          currentIndexRef.current = msg.data.question_index;
          setQuestions(questionsRef.current);
          setCurrentIndex(msg.data.question_index);
          setSelectedOption(null);
          setBotAnswer(null);
          setShowResult(false);
          setShowPending(true);
          Animated.timing(progressPendingOpacity, {
            toValue: 1, duration: 200, useNativeDriver: false,
          }).start();
          animateQuestion();
          startTimer();
        }
      }),
      // Game over
      wsOn('game_over', (msg) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const { your_score, opponent_score, your_correct } = msg.data || {};
        const userId = userIdRef.current;
        playSound(your_score >= opponent_score ? 'victory' : 'defeat');
        router.replace(
          `/results?playerScore=${your_score}&opponentScore=${opponent_score}&opponentPseudo=${params.opponentPseudo}&category=${params.category}&userId=${userId}&isBot=false&correctCount=${your_correct || correctCountRef.current}&opponentLevel=${params.opponentLevel || 1}&opponentId=${params.opponentId || ''}`
        );
      }),
      // Opponent disconnected
      wsOn('opponent_disconnected', (msg) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const { your_score, opponent_score, your_correct, compensation_points } = msg.data || {};
        // Navigate to results with auto-victory
        const userId = userIdRef.current;
        router.replace(
          `/results?playerScore=${your_score}&opponentScore=${opponent_score}&opponentPseudo=${params.opponentPseudo}&category=${params.category}&userId=${userId}&isBot=false&correctCount=${your_correct || correctCountRef.current}&opponentLevel=${params.opponentLevel || 1}&opponentId=${params.opponentId || ''}&opponentDisconnected=true`
        );
      }),
      // XP breakdown (sent after game_over)
      wsOn('match_xp', (msg) => {
        // The results screen handles this via submit-match for bots
        // For live games, the backend already saved results
      }),
    ];

    return () => unsubs.forEach((u) => u());
  // #38 — isLive is derived from URL params (never changes), use [] to prevent listener leak on re-render
  }, []);

  const loadPseudo = async () => {
    const p = await AsyncStorage.getItem('duelo_pseudo');
    if (p) setPseudo(p);
    const uid = await AsyncStorage.getItem('duelo_user_id');
    if (uid) userIdRef.current = uid;
  };

  const fetchQuestions = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const voFlag = await AsyncStorage.getItem(`duelo_vo_${params.category}`);
      const langParam = voFlag === 'true' ? '&lang=en' : '';
      const url = `${API_URL}/api/game/questions-v2?theme=${params.category}${langParam}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`${t('game.server_error')} (${res.status})`);
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error(t('game.no_questions'));
      }
      const loaded = data.slice(0, TOTAL_QUESTIONS);
      questionsRef.current = loaded;
      currentIndexRef.current = 0;
      setQuestions(loaded);
      setLoading(false);
      animateQuestion();
      startTimer();
    } catch (err: any) {
      setLoading(false);
      setLoadError(err.message || t('game.cannot_load_questions'));
    }
  };

  const animateQuestion = () => {
    questionFade.setValue(0);
    questionSlide.setValue(40);
    questionScaleAnim.setValue(0.95);
    Animated.parallel([
      Animated.timing(questionFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(questionSlide, { toValue: 0, duration: 300, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      Animated.timing(questionScaleAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  const triggerStreakToast = (streak: number) => {
    setStreakToastCount(streak);
    setStreakToastVisible(true);
    streakToastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(streakToastAnim, { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(streakToastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setStreakToastVisible(false));
  };

  const startTimer = () => {
    timeLeftRef.current = TIMER_DURATION;
    setTimeLeft(TIMER_DURATION);
    timerAnim.setValue(1);
    Animated.timing(timerAnim, {
      toValue: 0, duration: TIMER_DURATION * 1000, useNativeDriver: false,
    }).start();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      const remaining = timeLeftRef.current;
      setTimeLeft(remaining);
      if (remaining <= 3 && remaining > 0) playSound('tick');
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        handleTimeout();
      }
    }, 1000);
  };

  const resolveBotAnswer = (question: Question) => {
    // Use real bot stats from DB if available, otherwise fall back to defaults
    const skillLevel = parseFloat(params.botSkill || '') || 0.55;
    const avgSpeed   = parseFloat(params.botSpeed || '') || 5.0;

    const botCorrect = Math.random() < skillLevel;

    // Realistic time distribution: base ± wide variance, occasional outliers
    const r = Math.random();
    let botTimeSec: number;
    if (r < 0.08) {
      // ~8%: very fast (snap answer)
      botTimeSec = avgSpeed * (0.25 + Math.random() * 0.20);
    } else if (r < 0.15) {
      // ~7%: slow / hesitant
      botTimeSec = avgSpeed * (1.4 + Math.random() * 0.8);
    } else {
      // Normal range with ±50% variance (wider than before)
      botTimeSec = avgSpeed * (0.55 + Math.random() * 0.90);
    }
    botTimeSec = Math.max(0.6, Math.min(14, botTimeSec));
    const botTimeMs = Math.round(botTimeSec * 1000);

    if (botCorrect) {
      const speedBonus = Math.max(0, Math.round(10 * (1 - botTimeMs / 10000)));
      return { botPick: question.correct_option, botPts: Math.max(10 + speedBonus, 10), botTimeMs };
    }
    // Wrong answer: slight positional bias (humans don't pick uniformly)
    const wrongOpts = [0, 1, 2, 3].filter(i => i !== question.correct_option);
    // Weight first wrong option slightly higher (~45%), others equal
    const rw = Math.random();
    const botPick = rw < 0.45 ? wrongOpts[0] : wrongOpts[1 + Math.floor(Math.random() * (wrongOpts.length - 1))];
    return { botPick, botPts: 0, botTimeMs };
  };

  const handleAnswer = (pPts: number, bPts: number, botPick: number, botRevealDelay?: number) => {
    const newP = playerScoreRef.current + pPts;
    const newB = botScoreRef.current + bPts;
    playerScoreRef.current = newP;
    botScoreRef.current = newB;
    setPlayerScore(newP);
    setBotScore(newB);

    // Hide pending on bars (answered)
    setShowPending(false);

    // Animate progress bar: question completed
    const done = completedQuestions + 1;
    setCompletedQuestions(done);
    Animated.timing(progressAnim, {
      toValue: done / TOTAL_QUESTIONS,
      duration: 400,
      useNativeDriver: false,
    }).start();

    // Fade out progress pending
    Animated.timing(progressPendingOpacity, {
      toValue: 0, duration: 300, useNativeDriver: false,
    }).start();

    // Reveal bot answer with a small independent delay (simulates opponent responding
    // at their own pace rather than instantly when the player answers)
    const delay = botRevealDelay ?? 0;
    setTimeout(() => setBotAnswer(botPick), delay);

    setTimeout(nextQuestion, 2000);
  };

  const handleTimeout = () => {
    playerSelectionsRef.current[currentIndexRef.current] = -1;
    if (isLive) {
      // Send a "no answer" to the server (answer -1 = timeout)
      wsSend({
        action: 'game_answer',
        room_id: params.roomId,
        question_index: currentIndexRef.current,
        answer: -1,
        time_ms: TIMER_DURATION * 1000,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      setShowResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playSound('wrong');
      const question = questionsRef.current[currentIndexRef.current];
      if (!question) return;

      // Record timeout to history for async modes
      if (isAsync) {
        playerAnswersHistoryRef.current.push({
          answer: -1,
          is_correct: false,
          points: 0,
          time_ms: TIMER_DURATION * 1000,
        });
      }

      if (isAsyncReveal) {
        const p1 = p1AnswersRef.current[currentIndexRef.current];
        handleAnswer(0, p1?.points ?? 0, p1?.answer ?? -1);
      } else {
        const { botPick, botPts, botTimeMs } = resolveBotAnswer(question);
        // Simulate bot answering independently: reveal after a natural-looking delay
        const playerTimeMs = TIMER_DURATION * 1000;
        const revealDelay = botTimeMs < playerTimeMs ? 0 : Math.min(botTimeMs - playerTimeMs, 1400);
        handleAnswer(0, botPts, botPick, revealDelay);
      }
    }
  };

  const selectAnswer = useCallback((optionIndex: number) => {
    if (selectedOption !== null || showResult) return;
    if (isSubmittingRef.current) return; // #18 double-tap guard
    isSubmittingRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOption(optionIndex);
    playerSelectionsRef.current[currentIndexRef.current] = optionIndex;

    const timeTaken = TIMER_DURATION - timeLeftRef.current;
    const timeMs = timeTaken * 1000;

    if (isLive) {
      // Live multiplayer: send answer to server, wait for answer_result
      wsSend({
        action: 'game_answer',
        room_id: params.roomId,
        question_index: currentIndexRef.current,  // #8 — use ref, not stale state
        answer: optionIndex,
        time_ms: timeMs,
      });

      // #7 — If server hangs, show result then auto-advance to avoid infinite freeze
      if (wsAnswerTimeoutRef.current) clearTimeout(wsAnswerTimeoutRef.current);
      wsAnswerTimeoutRef.current = setTimeout(() => {
        setShowResult(true);
        setShowPending(false);
        isSubmittingRef.current = false;
        // Server never replied — advance after 2s so the game isn't stuck forever
        setTimeout(() => nextQuestion(), 2000);
      }, 8000);
      // Don't show result locally — wait for server response
    } else {
      // Bot mode: resolve locally
      setShowResult(true);
      // #9 — keep guard locked until nextQuestion() so rapid double-taps are blocked
      const question = questions[currentIndex];
      const isCorrect = optionIndex === question.correct_option;
      const pPts = isCorrect ? Math.max(MAX_PTS_PER_Q - timeTaken, 10) : 0;

      Haptics.notificationAsync(
        isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
      playSound(isCorrect ? 'correct' : 'wrong');

      // Track correct streak
      if (isCorrect) {
        const newStreak = correctStreakRef.current + 1;
        correctStreakRef.current = newStreak;
        setCorrectStreak(newStreak);
        if (newStreak === 3 || newStreak === 5 || newStreak === 7) {
          triggerStreakToast(newStreak);
        }
      } else {
        correctStreakRef.current = 0;
        setCorrectStreak(0);
      }

      if (isCorrect) correctCountRef.current += 1;

      // Record answer history for async modes
      if (isAsync) {
        playerAnswersHistoryRef.current.push({
          answer: optionIndex,
          is_correct: isCorrect,
          points: pPts,
          time_ms: timeMs,
        });
      }

      if (isAsyncReveal) {
        const p1 = p1AnswersRef.current[currentIndex];
        handleAnswer(pPts, p1?.points ?? 0, p1?.answer ?? -1);
      } else {
        const { botPick, botPts, botTimeMs } = resolveBotAnswer(question);
        // If the bot would have answered after the player, reveal its answer with a delay
        const revealDelay = botTimeMs > timeMs ? Math.min(botTimeMs - timeMs, 1400) : 0;
        handleAnswer(pPts, botPts, botPick, revealDelay);
      }
    }
  }, [selectedOption, showResult, currentIndex, questions, isLive, isAsync, isAsyncReveal]);

  const nextQuestion = () => {
    isSubmittingRef.current = false; // #9 — reset double-tap guard here, not earlier
    if (currentIndexRef.current + 1 >= questionsRef.current.length) {
      endGame();
      return;
    }
    currentIndexRef.current += 1;
    setCurrentIndex(currentIndexRef.current);
    setSelectedOption(null);
    setBotAnswer(null);
    setShowResult(false);
    setShowPending(true);
    // Reset timer anim for new question
    timerAnim.setValue(1);

    // Show progress pending for new question
    Animated.timing(progressPendingOpacity, {
      toValue: 1, duration: 200, useNativeDriver: false,
    }).start();

    animateQuestion();
    startTimer();
  };

  const endGame = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const userId = await AsyncStorage.getItem('duelo_user_id');
    const ps = playerScoreRef.current;
    const bs = botScoreRef.current;
    playSound(ps >= bs ? 'victory' : 'defeat');
    const cc = correctCountRef.current;
    const ol = parseInt(params.opponentLevel || '1') || 1;
    // Save questions for the report feature on results screen
    try {
      await AsyncStorage.setItem('duelo_last_quiz_questions', JSON.stringify(questions));
      const selections = questions.map((_, i) =>
        playerSelectionsRef.current[i] !== undefined ? playerSelectionsRef.current[i] : -1
      );
      await AsyncStorage.setItem('duelo_last_player_answers', JSON.stringify(selections));
    } catch (e) { console.error(e); }
    // Async challenge mode: save score + per-question answers (with retry + offline queue)
    if (params.challenge_id && isAsync) {
      const { ok, data: saveData } = await saveScoreWithRetry(
        params.challenge_id,
        { user_id: userId || '', score: ps, correct: cc, answers: playerAnswersHistoryRef.current }
      );
      if (ok && saveData?.status === 'completed') {
        // Both players have now played → show results immediately with both real scores
        const opponentFinalScore = isAsyncSolo ? saveData.p2_score : saveData.p1_score;
        router.replace(
          `/results?playerScore=${ps}&opponentScore=${opponentFinalScore}&opponentPseudo=${params.opponentPseudo}&category=${params.category}&userId=${userId}&isBot=false&correctCount=${cc}&opponentLevel=1&opponentId=`
        );
        return;
      }
      // First to finish or network error — show async banner
      router.replace(
        `/results?playerScore=${ps}&opponentScore=0&opponentPseudo=${params.opponentPseudo}&category=${params.category}&userId=${userId}&isBot=true&correctCount=${cc}&opponentLevel=1&opponentId=&asyncChallenge=true&challengeOpponent=${encodeURIComponent(params.opponentPseudo || '')}`
      );
      return;
    }
    router.replace(
      `/results?playerScore=${ps}&opponentScore=${bs}&opponentPseudo=${params.opponentPseudo}&category=${params.category}&userId=${userId}&isBot=${params.isBot}&correctCount=${cc}&opponentLevel=${ol}&opponentId=${params.opponentId || ''}`
    );
  };

  if (loading || questions.length === 0) {
    const spinInterp = spinAnim.interpolate({
      inputRange: [0, 1], outputRange: ['0deg', '360deg'],
    });

    // Invalid params — guard after all hooks
    if (!themeId) {
      Alert.alert(t('common.error'), t('game.invalid_game'), [{ text: t('common.ok'), onPress: () => router.replace('/(tabs)/play') }]);
      return null;
    }

    // Show error state
    if (loadError) {
      return (
        <SwipeBackPage>
        <View style={styles.container}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.loadingView}>
              <View style={styles.errorIconWrap}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#FF6B6B" />
              </View>
              <Text style={styles.errorTitle}>{t('game.loading_error')}</Text>
              <Text style={styles.errorMessage}>{loadError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchQuestions} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#8A2BE2', '#6A1FBF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.retryBtnGradient}
                >
                  <MaterialCommunityIcons name="refresh" size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtnLoading} onPress={() => router.back()} activeOpacity={0.8}>
                <MaterialCommunityIcons name="arrow-left" size={16} color="#888" style={{ marginRight: 6 }} />
                <Text style={styles.backBtnLoadingText}>{t('common.back')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
        </SwipeBackPage>
      );
    }

    // Loading spinner
    return (
      <SwipeBackPage>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingView}>
            <View style={styles.spinnerContainer}>
              <Animated.View style={[styles.spinnerOuter, { transform: [{ rotate: spinInterp }] }]}>
                <View style={styles.spinnerDot} />
              </Animated.View>
              <Animated.View style={[styles.spinnerInner, { opacity: pulseAnim }]}>
                <MaterialCommunityIcons name="target" size={28} color="#8A2BE2" />
              </Animated.View>
            </View>
            <Animated.Text style={[styles.loadingTitle, { opacity: pulseAnim }]}>
              {t('game.loading_questions')}
            </Animated.Text>
            <Text style={styles.loadingSubtitle}>
              {t('game.fetching_from_db')}
            </Text>
            <ActivityIndicator color="#8A2BE2" size="small" style={{ marginTop: 16 }} />
          </View>
        </SafeAreaView>
      </View>
      </SwipeBackPage>
    );
  }

  const question = questions[currentIndex];
  const optionRows: Array<[number, number]> = [[0, 1], [2, 3]];

  // La bonne réponse révélée passe en gradient menthe plein (texte sombre)
  const isOptionCorrectReveal = (index: number): boolean => {
    if (!showResult) return false;
    return isLive
      ? (index === selectedOption && lastAnswerCorrectRef.current)
      : index === question.correct_option;
  };

  const getOptionFill = (index: number): [string, string] => {
    if (!showResult) return [`${OPTION_COLORS[index]}18`, `${OPTION_COLORS[index]}08`];
    const isWrong = isLive
      ? (index === selectedOption && !lastAnswerCorrectRef.current)
      : (index === selectedOption && index !== question.correct_option);
    if (isOptionCorrectReveal(index)) return [MINT, '#1FA877'];
    if (isWrong) return ['rgba(255,61,94,0.22)', 'rgba(255,61,94,0.06)'];
    return ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.02)'];
  };

  const getOptionBorderCol = (index: number): string => {
    if (!showResult) return `${OPTION_COLORS[index]}55`;
    const isWrong = isLive
      ? (index === selectedOption && !lastAnswerCorrectRef.current)
      : (index === selectedOption && index !== question.correct_option);
    if (isOptionCorrectReveal(index)) return MINT;
    if (isWrong) return RED;
    return 'rgba(255,255,255,0.06)';
  };

  const getOptionTxtCol = (index: number): string => {
    if (!showResult) return '#FFF';
    const isWrong = isLive
      ? (index === selectedOption && !lastAnswerCorrectRef.current)
      : (index === selectedOption && index !== question.correct_option);
    if (isOptionCorrectReveal(index)) return '#050510';
    if (isWrong) return RED;
    return 'rgba(255,255,255,0.28)';
  };

  return (
    <SwipeBackPage>
    <View style={styles.container}>
      {/* Fond : teinte cyan en haut → violet en bas (duel) */}
      <LinearGradient
        colors={['rgba(0,229,255,0.10)', '#050510', '#050510', 'rgba(179,102,255,0.10)']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <Animated.View style={[styles.progressBarSolid, {
          width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]}>
          <LinearGradient colors={[CYAN, '#00A8CC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* Score boxes + Round Timer */}
        <View style={styles.scoreTimerRow}>
          <View style={[styles.scoreBox, styles.scoreBoxPlayer]}>
            <LinearGradient colors={['rgba(0,229,255,0.12)', 'rgba(0,229,255,0.03)']} style={StyleSheet.absoluteFill} />
            <View style={[styles.scoreAvatar, { borderColor: 'rgba(0,229,255,0.5)' }]}>
              <Text style={styles.scoreAvatarLetter}>{pseudo[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.scoreMeta}>
              <Text style={[styles.scoreBoxName, { color: CYAN }]} numberOfLines={1}>{pseudo}</Text>
              <Text style={styles.scoreBoxScore}>{playerScore}</Text>
            </View>
          </View>

          <View style={styles.timerSection}>
            <RoundTimer timeLeft={timeLeft} total={TIMER_DURATION} />
          </View>

          <View style={[styles.scoreBox, styles.scoreBoxOpponent]}>
            <LinearGradient colors={['rgba(179,102,255,0.12)', 'rgba(179,102,255,0.03)']} style={StyleSheet.absoluteFill} />
            <View style={[styles.scoreAvatar, { borderColor: 'rgba(179,102,255,0.5)' }]}>
              <Text style={styles.scoreAvatarLetter}>{(params.opponentPseudo || 'B')[0]?.toUpperCase()}</Text>
            </View>
            <View style={[styles.scoreMeta, styles.scoreMetaRight]}>
              <Text style={[styles.scoreBoxName, { color: VIOLET }]} numberOfLines={1}>
                {params.opponentPseudo?.slice(0, 10)}
              </Text>
              <Text style={styles.scoreBoxScore}>
                {isAsyncSolo ? '—' : botScore}
              </Text>
            </View>
          </View>
        </View>

        {/* Dots progression */}
        <View style={styles.dotsProgressRow}>
          {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
            <View key={i} style={[
              styles.dot,
              i < completedQuestions ? styles.dotDone :
              i === completedQuestions ? styles.dotCurrent : styles.dotPending,
            ]} />
          ))}
        </View>

        {/* Question + 2×2 Options */}
        <View style={styles.centerContent}>
          <Animated.View style={[styles.questionBox, {
            opacity: questionFade,
            transform: [{ translateX: questionSlide }, { scale: questionScaleAnim }],
          }]}>
            <Text style={styles.questionEyebrow}>◆ Q{currentIndex + 1} · {questions.length}</Text>
            <Text style={styles.questionText}>{question.question_text}</Text>
          </Animated.View>

          <View style={styles.optionsGrid}>
            {optionRows.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.optionsRow}>
                {row.map((index) => {
                  const optColor = OPTION_COLORS[index];
                  const fillColors = getOptionFill(index);
                  const borderColor = getOptionBorderCol(index);
                  const textColor = getOptionTxtCol(index);
                  const isPlayerPick = selectedOption === index;
                  const isBotPick = botAnswer === index;
                  const correctReveal = isOptionCorrectReveal(index);
                  return (
                    <TouchableOpacity
                      key={index}
                      testID={`option-${index}`}
                      style={[styles.optionCard2x2, { borderColor }, correctReveal && styles.optionCardCorrect]}
                      onPress={() => selectAnswer(index)}
                      disabled={showResult}
                      activeOpacity={0.85}
                    >
                      <LinearGradient colors={fillColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                      <View style={[styles.optionLetterBadge, {
                        backgroundColor: correctReveal ? 'rgba(5,5,16,0.18)' : showResult ? 'rgba(255,255,255,0.05)' : `${optColor}22`,
                      }]}>
                        <Text style={[styles.optionLetterText, {
                          color: correctReveal ? '#050510' : showResult ? 'rgba(255,255,255,0.25)' : optColor,
                        }]}>
                          {['A', 'B', 'C', 'D'][index]}
                        </Text>
                      </View>
                      <Text style={[styles.optionText2x2, { color: textColor }]} numberOfLines={3}>
                        {question.options[index]}
                      </Text>
                      {showResult && isPlayerPick && (
                        <View style={styles.optionIndicatorPlayer}>
                          <MaterialCommunityIcons
                            name={correctReveal ? 'check-circle' : 'close-circle'}
                            size={16}
                            color={correctReveal ? '#050510' : RED}
                          />
                        </View>
                      )}
                      {showResult && isBotPick && !isPlayerPick && (
                        <View style={styles.optionIndicatorBot} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

      </SafeAreaView>

      {/* Streak Toast */}
      {streakToastVisible && (
        <View style={styles.streakToastWrapper} pointerEvents="none">
        <Animated.View style={[styles.streakToast, {
          opacity: streakToastAnim,
          transform: [{ scale: streakToastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }]}>
          <LinearGradient
            colors={streakToastCount === 7 ? ['#FFD700', '#FF9F0A'] : ['#8A2BE2', '#A855F7']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.streakToastGrad}
          >
            <Text style={styles.streakToastEmoji}>
              {streakToastCount === 7 ? '🏆' : streakToastCount === 5 ? '⚡' : '🔥'}
            </Text>
            <Text style={styles.streakToastText}>
              {streakToastCount === 7 ? 'PARFAIT !' : `${streakToastCount}x EN SÉRIE !`}
            </Text>
          </LinearGradient>
        </Animated.View>
        </View>
      )}
    </View>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  safeArea: { flex: 1 },
  loadingView: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { color: '#FFF', fontSize: 16 },

  // Loading spinner
  spinnerContainer: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  spinnerOuter: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: 'transparent',
    borderTopColor: '#8A2BE2', borderRightColor: 'rgba(138,43,226,0.3)',
    position: 'absolute',
  },
  spinnerInner: { justifyContent: 'center', alignItems: 'center' },
  spinnerDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#8A2BE2',
    position: 'absolute', top: 0, left: '50%', marginLeft: -4,
  },
  loadingTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  loadingSubtitle: { color: '#888', fontSize: 13, textAlign: 'center' },

  // Error state
  errorIconWrap: { marginBottom: 16 },
  errorTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  errorMessage: { color: '#AAA', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  retryBtn: {
    borderRadius: 12, overflow: 'hidden',
    marginBottom: 12,
  },
  retryBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12,
  },
  retryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  backBtnLoading: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: GLASS.bg,
  },
  backBtnLoadingText: { color: '#888', fontSize: 14, fontWeight: '600' },

  // Progress bar (question advancement)
  progressBarBg: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.06)', width: '100%',
    overflow: 'hidden',
  },
  progressBarSolid: {
    position: 'absolute', height: 4,
    borderRadius: 0, overflow: 'hidden',
  },
  progressBarPending: {
    position: 'absolute', height: 4,
    backgroundColor: 'rgba(138,43,226,0.35)',
  },

  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: GLASS.bg,
    borderBottomWidth: 1, borderBottomColor: GLASS.borderSubtle,
  },
  playerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  opponentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarLetter: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  playerMeta: { marginHorizontal: 8 },
  playerName: { color: '#FFF', fontSize: 13, fontWeight: '700', maxWidth: 80 },
  playerTitle: { color: '#666', fontSize: 10, marginBottom: 2 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  playerScoreNum: { color: '#00C853', fontSize: 20, fontWeight: '900' },

  // Timer
  timerCenter: { alignItems: 'center', paddingHorizontal: 8 },
  timerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 },
  timerLabel: { color: '#888', fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  timerCircle: {
    width: 50, height: 50, borderRadius: 25, borderWidth: 2.5, borderColor: '#00BFFF',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  timerDanger: { borderColor: '#FF3B30' },
  timerNum: { color: '#00BFFF', fontSize: 22, fontWeight: '900' },
  timerNumDanger: { color: '#FF3B30' },
  timerSweep: {
    position: 'absolute', bottom: 0, left: 0, height: 3,
  },
  // Streak toast
  streakToastWrapper: {
    position: 'absolute', top: '38%', left: 0, right: 0,
    alignItems: 'center',
  },
  streakToast: {
    borderRadius: 20, overflow: 'hidden', elevation: 10,
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12,
  },
  streakToastGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  streakToastEmoji: { fontSize: 22 },
  streakToastText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1.5 },

  questionCounterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8,
  },
  questionCounter: {
    color: '#666', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 2,
  },

  // Game area
  gameArea: { flex: 1, flexDirection: 'row' },

  // Score bars
  barColumn: { width: 22, paddingVertical: 8, alignItems: 'center' },
  barTrack: {
    width: 14, flex: 1, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 7, overflow: 'hidden', position: 'relative',
  },
  barScoreLabel: { flexDirection: 'column', alignItems: 'center', marginTop: 4 },
  barScoreText: { fontSize: 9, fontWeight: '800' },

  // Center (full-width, no side bars)
  centerContent: { flex: 1 },
  questionBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, marginHorizontal: 12, marginVertical: 8,
    paddingHorizontal: 20, paddingVertical: 18,
    alignItems: 'center',
  },
  questionEyebrow: {
    color: GOLD, fontSize: 11, fontWeight: '700',
    fontFamily: 'JetBrainsMono_700Bold',
    letterSpacing: 2, marginBottom: 8,
  },
  questionText: { color: '#FFF', fontSize: 24, fontWeight: '900', fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center', lineHeight: 28, letterSpacing: -0.5 },

  // 2×2 Options grid
  optionsGrid: { flex: 1, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4, gap: 10 },
  optionsRow: { flex: 1, flexDirection: 'row', gap: 10 },
  optionCard2x2: {
    flex: 1, borderRadius: 16, borderWidth: 2, overflow: 'hidden',
    padding: 12, justifyContent: 'space-between',
  },
  optionCardCorrect: {
    shadowColor: MINT, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 8,
  },
  optionLetterBadge: {
    width: 28, height: 28, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6, alignSelf: 'flex-start',
  },
  optionLetterText: { fontSize: 13, fontWeight: '900' },
  optionText2x2: { fontSize: 15, fontWeight: '700', lineHeight: 20, flex: 1 },
  optionIndicatorPlayer: { alignSelf: 'flex-end', marginTop: 4 },
  optionIndicatorBot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: VIOLET, alignSelf: 'flex-end', marginTop: 4,
  },

  // Score boxes + timer row
  scoreTimerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8, gap: 6,
  },
  scoreBox: {
    flex: 1, borderRadius: 12, overflow: 'hidden',
    paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  scoreBoxPlayer: { borderColor: 'rgba(0,229,255,0.40)' },
  scoreBoxOpponent: { borderColor: 'rgba(179,102,255,0.40)', flexDirection: 'row-reverse' },
  scoreAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
  },
  scoreAvatarLetter: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  scoreMeta: { flex: 1 },
  scoreMetaRight: { alignItems: 'flex-end' },
  scoreBoxName: {
    fontFamily: 'JetBrainsMono_400Regular', fontSize: 9,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2,
  },
  scoreBoxScore: { color: '#FFF', fontSize: 22, fontWeight: '900', fontFamily: 'SpaceGrotesk_700Bold', lineHeight: 24 },
  timerSection: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },

  // Dots progression
  dotsProgressRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingVertical: 4,
  },
  dot: { width: 20, height: 5, borderRadius: 3 },
  dotDone: { backgroundColor: MINT },
  dotCurrent: {
    backgroundColor: GOLD,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4,
    elevation: 3,
  },
  dotPending: { backgroundColor: 'rgba(255,255,255,0.12)' },
});
