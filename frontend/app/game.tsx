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
import { useWS } from '../contexts/WebSocketContext';
import { authFetch } from '../utils/api';
import { saveScoreWithRetry } from '../utils/pendingScores';
import { t } from '../utils/i18n';

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

// ── Animated Score Bar component ──
function AnimatedBar({ score, showPending, isPlayer }: { score: number; showPending: boolean; isPlayer?: boolean }) {
  const [trackHeight, setTrackHeight] = useState(0);
  const barHeightAnim = useRef(new Animated.Value(0)).current;
  const pendingOpacity = useRef(new Animated.Value(1)).current;
  const prevScore = useRef(0);

  useEffect(() => {
    if (trackHeight <= 0) return;

    const targetH = (score / MAX_TOTAL) * trackHeight;

    // Animate the bar growing smoothly
    Animated.timing(barHeightAnim, {
      toValue: targetH,
      duration: 500,
      useNativeDriver: false,
    }).start();

    prevScore.current = score;
  }, [score, trackHeight]);

  useEffect(() => {
    // Fade pending in/out
    Animated.timing(pendingOpacity, {
      toValue: showPending ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showPending]);

  const pendingHeight = trackHeight > 0 ? (MAX_PTS_PER_Q / MAX_TOTAL) * trackHeight : 0;
  const barColor = isPlayer ? '#8A2BE2' : '#2196F3';
  const pendingColor = isPlayer ? 'rgba(138,43,226,0.30)' : 'rgba(33,150,243,0.30)';

  return (
    <View style={styles.barColumn}>
      <View
        style={styles.barTrack}
        onLayout={(e) => setTrackHeight(e.nativeEvent.layout.height)}
      >
        {/* Pending area — sits on top of earned */}
        <Animated.View style={{
          position: 'absolute',
          left: 0, right: 0,
          bottom: barHeightAnim,
          height: pendingHeight,
          backgroundColor: pendingColor,
          borderRadius: 7,
          opacity: pendingOpacity,
        }} />

        {/* Earned (solid, grows from bottom) */}
        <Animated.View style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          height: barHeightAnim,
          backgroundColor: barColor,
          borderRadius: 7,
        }} />
      </View>
      <View style={styles.barScoreLabel}>
        <MaterialCommunityIcons name="star" size={10} color={barColor} />
        <Text style={[styles.barScoreText, { color: barColor }]}>{score}</Text>
      </View>
    </View>
  );
}

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
  const userIdRef = useRef<string | null>(null);
  const lastAnswerCorrectRef = useRef(false);

  // Async challenge tracking
  type AnswerRecord = { answer: number; is_correct: boolean; points: number; time_ms: number };
  const playerAnswersHistoryRef = useRef<AnswerRecord[]>([]);
  const p1AnswersRef = useRef<{ answer: number; is_correct: boolean; points: number }[]>([]);

  // Guards
  const isSubmittingRef = useRef(false);               // #18 double-tap prevention
  const wsAnswerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // #17 WS hang timeout

  // Progress bar animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressPendingOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
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
    Animated.timing(questionFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
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
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        handleTimeout();
      }
    }, 1000);
  };

  const resolveBotAnswer = (question: Question) => {
    // Use real bot stats from DB if available, otherwise fall back to defaults
    const skillLevel = parseFloat(params.botSkill || '') || 0.55;  // probability of correct answer
    const avgSpeed   = parseFloat(params.botSpeed || '') || 5.0;   // avg response time in seconds

    const botCorrect = Math.random() < skillLevel;
    // Response time: avg_speed ± 30% variance, clamped 0.8s–14s
    const botTimeSec = Math.max(0.8, Math.min(14, avgSpeed * (0.7 + Math.random() * 0.6)));
    const botTimeMs  = Math.round(botTimeSec * 1000);

    if (botCorrect) {
      const speedBonus = Math.max(0, Math.round(10 * (1 - botTimeMs / 10000)));
      return { botPick: question.correct_option, botPts: Math.max(10 + speedBonus, 10) };
    }
    const wrongOpts = [0, 1, 2, 3].filter(i => i !== question.correct_option);
    return { botPick: wrongOpts[Math.floor(Math.random() * wrongOpts.length)], botPts: 0 };
  };

  const handleAnswer = (pPts: number, bPts: number, botPick: number) => {
    const newP = playerScoreRef.current + pPts;
    const newB = botScoreRef.current + bPts;
    playerScoreRef.current = newP;
    botScoreRef.current = newB;
    setPlayerScore(newP);
    setBotScore(newB);
    setBotAnswer(botPick);

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

    setTimeout(nextQuestion, 2000);
  };

  const handleTimeout = () => {
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
        const { botPick, botPts } = resolveBotAnswer(question);
        handleAnswer(0, botPts, botPick);
      }
    }
  };

  const selectAnswer = useCallback((optionIndex: number) => {
    if (selectedOption !== null || showResult) return;
    if (isSubmittingRef.current) return; // #18 double-tap guard
    isSubmittingRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOption(optionIndex);

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
        const { botPick, botPts } = resolveBotAnswer(question);
        handleAnswer(pPts, botPts, botPick);
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
    const cc = correctCountRef.current;
    const ol = parseInt(params.opponentLevel || '1') || 1;
    // Save questions for the report feature on results screen
    try {
      await AsyncStorage.setItem('duelo_last_quiz_questions', JSON.stringify(questions));
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

  const getOptionBorderStyle = (index: number) => {
    if (!showResult) return {};
    if (isLive) {
      // Live mode: only highlight selected answer based on server result
      if (index === selectedOption) {
        const wasCorrect = lastAnswerCorrectRef.current;
        return { borderColor: wasCorrect ? '#00C853' : '#FF3B30', borderWidth: 2.5 };
      }
      return {};
    }
    if (index === question.correct_option) return { borderColor: '#00C853', borderWidth: 2.5 };
    if (index === selectedOption) return { borderColor: '#FF3B30', borderWidth: 2.5 };
    return {};
  };

  const getOptionTextColor = (index: number) => {
    if (!showResult) return '#FFF';
    if (isLive) {
      if (index === selectedOption) {
        return lastAnswerCorrectRef.current ? '#00C853' : '#FF3B30';
      }
      return '#666';
    }
    if (index === question.correct_option) return '#00C853';
    if (index === selectedOption) return '#FF3B30';
    return '#666';
  };

  const getOptionIcon = (index: number) => {
    if (!showResult) return null;
    if (isLive) {
      if (index === selectedOption) {
        return lastAnswerCorrectRef.current
          ? <MaterialCommunityIcons name="check-circle" size={20} color="#00C853" />
          : <MaterialCommunityIcons name="close-circle" size={20} color="#FF3B30" />;
      }
      return null;
    }
    if (index === question.correct_option) return <MaterialCommunityIcons name="check-circle" size={20} color="#00C853" />;
    if (index === selectedOption) return <MaterialCommunityIcons name="close-circle" size={20} color="#FF3B30" />;
    return null;
  };

  const oneQPct = (1 / TOTAL_QUESTIONS) * 100; // ~14.3%

  const timerColor = timeLeft <= 3 ? '#FF3B30' : '#00BFFF';

  return (
    <SwipeBackPage>
    <View style={styles.container}>
      {/* ── Progress Bar (Question advancement, not timer) ── */}
      <View style={styles.progressBarBg}>
        {/* Solid completed portion */}
        <Animated.View style={[styles.progressBarSolid, {
          width: progressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }]}>
          <LinearGradient
            colors={['#8A2BE2', '#B24BF3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {/* Pending portion for current question */}
        <Animated.View style={[styles.progressBarPending, {
          width: `${oneQPct}%`,
          left: progressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
          opacity: progressPendingOpacity,
        }]} />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={styles.playerInfo}>
            <LinearGradient
              colors={['#8A2BE2', '#6A1FBF']}
              style={styles.avatarCircle}
            >
              <Text style={styles.avatarLetter}>{pseudo[0]?.toUpperCase()}</Text>
            </LinearGradient>
            <View style={styles.playerMeta}>
              <Text style={styles.playerName} numberOfLines={1}>{pseudo}</Text>
              <Text style={styles.playerTitle}>{t('game.challenger')}</Text>
              <View style={styles.scoreRow}>
                <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
                <Text style={styles.playerScoreNum}>{playerScore}</Text>
              </View>
            </View>
          </View>

          <View style={styles.timerCenter}>
            <View style={styles.timerLabelRow}>
              <MaterialCommunityIcons name="timer-outline" size={10} color="#888" />
              <Text style={styles.timerLabel}>{t('game.time')}</Text>
            </View>
            <View style={[styles.timerCircle, timeLeft <= 3 && styles.timerDanger]}>
              <LinearGradient
                colors={timeLeft <= 3 ? ['rgba(255,59,48,0.15)', 'rgba(255,59,48,0.05)'] : ['rgba(0,191,255,0.15)', 'rgba(0,191,255,0.05)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={[styles.timerNum, { color: timerColor }]}>{timeLeft}</Text>
            </View>
          </View>

          <View style={styles.opponentInfo}>
            <View style={styles.playerMeta}>
              <Text style={[styles.playerName, { textAlign: 'right' }]} numberOfLines={1}>
                {params.opponentPseudo?.slice(0, 10)}
              </Text>
              <Text style={[styles.playerTitle, { textAlign: 'right' }]}>
                {isLive ? t('game.online') : isAsyncSolo ? t('game.async_will_play') : isAsyncReveal ? t('game.already_played') : t('game.bot')}
              </Text>
              <View style={[styles.scoreRow, { justifyContent: 'flex-end' }]}>
                <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
                <Text style={[styles.playerScoreNum, { textAlign: 'right' }]}>
                  {isAsyncSolo ? '—' : botScore}
                </Text>
              </View>
            </View>
            <LinearGradient
              colors={['#2196F3', '#1976D2']}
              style={styles.avatarCircle}
            >
              <Text style={styles.avatarLetter}>{(params.opponentPseudo || 'B')[0]?.toUpperCase()}</Text>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.questionCounterRow}>
          <MaterialCommunityIcons name="progress-check" size={14} color="#666" />
          <Text style={styles.questionCounter}>{t('game.question')} {currentIndex + 1}/{questions.length}</Text>
        </View>

        {/* ── Main Area ── */}
        <View style={styles.gameArea}>
          {/* LEFT BAR (Player) */}
          <AnimatedBar score={playerScore} showPending={showPending} isPlayer={true} />

          {/* CENTER CONTENT */}
          <View style={styles.centerContent}>
            <Animated.View style={[styles.questionBox, { opacity: questionFade }]}>
              <View style={styles.questionInner}>
                <MaterialCommunityIcons name="help-circle-outline" size={20} color="rgba(138,43,226,0.5)" style={{ marginBottom: 8 }} />
                <Text style={styles.questionText}>{question.question_text}</Text>
              </View>
            </Animated.View>

            <View style={styles.optionsBox}>
              {question.options.map((option, index) => {
                const isPlayerPick = selectedOption === index;
                const isBotPick = botAnswer === index;
                const icon = getOptionIcon(index);

                return (
                  <TouchableOpacity
                    testID={`option-${index}`}
                    key={index}
                    style={[styles.optionCard, getOptionBorderStyle(index)]}
                    onPress={() => selectAnswer(index)}
                    disabled={showResult}
                    activeOpacity={0.85}
                  >
                    {showResult && isPlayerPick && (
                      <View style={styles.triLeftAnchor}>
                        <View style={styles.triLeft} />
                      </View>
                    )}

                    <View style={styles.optionContent}>
                      {icon && <View style={styles.optionIcon}>{icon}</View>}
                      <Text style={[styles.optionText, { color: getOptionTextColor(index) }]} numberOfLines={2}>
                        {option}
                      </Text>
                    </View>

                    {showResult && isBotPick && (
                      <View style={styles.triRightAnchor}>
                        <View style={styles.triRight} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* RIGHT BAR (Bot) */}
          <AnimatedBar score={botScore} showPending={showPending} isPlayer={false} />
        </View>
      </SafeAreaView>
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

  // Center
  centerContent: { flex: 1, paddingHorizontal: 4 },
  questionBox: {
    paddingHorizontal: 16, paddingVertical: 16,
    justifyContent: 'center', alignItems: 'center', minHeight: 80,
  },
  questionInner: { alignItems: 'center' },
  questionText: { color: '#FFF', fontSize: 20, fontWeight: '800', textAlign: 'center', lineHeight: 28 },

  // Options
  optionsBox: { flex: 1, justifyContent: 'center', gap: 10, paddingBottom: 16, paddingHorizontal: 8 },
  optionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: GLASS.radius,
    paddingVertical: 16, paddingHorizontal: 20,
    justifyContent: 'center', alignItems: 'center',
    minHeight: 56, borderWidth: 1, borderColor: GLASS.borderSubtle,
    position: 'relative', overflow: 'visible',
  },
  optionContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionIcon: { marginRight: 4 },
  optionText: { fontSize: 17, fontWeight: '800', textAlign: 'center', color: '#FFF', flexShrink: 1 },

  // Triangles
  triLeftAnchor: {
    position: 'absolute', left: -16, top: 0, bottom: 0,
    width: 16, justifyContent: 'center', alignItems: 'flex-end',
  },
  triLeft: {
    width: 0, height: 0,
    borderTopWidth: 14, borderTopColor: 'transparent',
    borderBottomWidth: 14, borderBottomColor: 'transparent',
    borderLeftWidth: 16, borderLeftColor: '#8A2BE2',
  },
  triRightAnchor: {
    position: 'absolute', right: -16, top: 0, bottom: 0,
    width: 16, justifyContent: 'center', alignItems: 'flex-start',
  },
  triRight: {
    width: 0, height: 0,
    borderTopWidth: 14, borderTopColor: 'transparent',
    borderBottomWidth: 14, borderBottomColor: 'transparent',
    borderRightWidth: 16, borderRightColor: '#2196F3',
  },
});
