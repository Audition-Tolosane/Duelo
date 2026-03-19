import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
  Platform, UIManager, ActivityIndicator, Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { GLASS } from '../theme/glassTheme';
import SwipeBackPage from '../components/SwipeBackPage';
import { useWS } from '../contexts/WebSocketContext';

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
function AnimatedBar({ score, showPending }: { score: number; showPending: boolean }) {
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
          backgroundColor: 'rgba(0,200,83,0.30)',
          borderRadius: 7,
          opacity: pendingOpacity,
        }} />

        {/* Earned (solid green, grows from bottom) */}
        <Animated.View style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          height: barHeightAnim,
          backgroundColor: '#00C853',
          borderRadius: 7,
        }} />
      </View>
    </View>
  );
}

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category: string; opponentPseudo: string; opponentSeed: string; isBot: string; roomId: string; opponentLevel: string;
  }>();
  const { send: wsSend, on: wsOn } = useWS();

  const isLive = params.roomId && params.isBot !== 'true';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [botAnswer, setBotAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState('Joueur');
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
  const timerAnim = useRef(new Animated.Value(1)).current;
  const questionFade = useRef(new Animated.Value(0)).current;
  const userIdRef = useRef<string | null>(null);
  const lastAnswerCorrectRef = useRef(false);

  // Progress bar animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressPendingOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadPseudo();

    if (isLive) {
      // Live multiplayer: wait for game_start from WebSocket
      // Questions are loaded server-side and pushed to us
    } else {
      // Bot mode: fetch questions via HTTP
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
          setQuestions([q]); // We receive questions one at a time
          setLoading(false);
          animateQuestion();
          startTimer();
        }
      }),
      // Our answer result
      wsOn('answer_result', (msg) => {
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
          setQuestions((prev) => [...prev, q]);
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
          `/results?playerScore=${your_score}&opponentScore=${opponent_score}&opponentPseudo=${params.opponentPseudo}&category=${params.category}&userId=${userId}&isBot=false&correctCount=${your_correct || correctCountRef.current}&opponentLevel=${params.opponentLevel || 1}`
        );
      }),
      // XP breakdown (sent after game_over)
      wsOn('match_xp', (msg) => {
        // The results screen handles this via submit-match for bots
        // For live games, the backend already saved results
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [isLive]);

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
      const res = await fetch(`${API_URL}/api/game/questions-v2?theme=${params.category}`);
      if (!res.ok) {
        throw new Error(`Erreur serveur (${res.status})`);
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Aucune question disponible pour cette catégorie');
      }
      setQuestions(data.slice(0, TOTAL_QUESTIONS));
      setLoading(false);
      animateQuestion();
      startTimer();
    } catch (err: any) {
      setLoading(false);
      setLoadError(err.message || 'Impossible de charger les questions');
    }
  };

  const animateQuestion = () => {
    questionFade.setValue(0);
    Animated.timing(questionFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };

  const startTimer = () => {
    setTimeLeft(TIMER_DURATION);
    timerAnim.setValue(1);
    Animated.timing(timerAnim, {
      toValue: 0, duration: TIMER_DURATION * 1000, useNativeDriver: false,
    }).start();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resolveBotAnswer = (question: Question) => {
    const botCorrect = Math.random() > 0.35;
    if (botCorrect) {
      const botTime = Math.floor(Math.random() * 7) + 2;
      return { botPick: question.correct_option, botPts: Math.max(MAX_PTS_PER_Q - botTime, 10) };
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
        question_index: currentIndex,
        answer: -1,
        time_ms: TIMER_DURATION * 1000,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      setShowResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const question = questions[currentIndex];
      const { botPick, botPts } = resolveBotAnswer(question);
      handleAnswer(0, botPts, botPick);
    }
  };

  const selectAnswer = useCallback((optionIndex: number) => {
    if (selectedOption !== null || showResult) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOption(optionIndex);

    const timeTaken = TIMER_DURATION - timeLeft;
    const timeMs = timeTaken * 1000;

    if (isLive) {
      // Live multiplayer: send answer to server, wait for answer_result
      wsSend({
        action: 'game_answer',
        room_id: params.roomId,
        question_index: currentIndex,
        answer: optionIndex,
        time_ms: timeMs,
      });
      // Don't show result locally — wait for server response
    } else {
      // Bot mode: resolve locally
      setShowResult(true);

      const question = questions[currentIndex];
      const isCorrect = optionIndex === question.correct_option;
      const pPts = isCorrect ? Math.max(MAX_PTS_PER_Q - timeTaken, 10) : 0;

      Haptics.notificationAsync(
        isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );

      if (isCorrect) correctCountRef.current += 1;

      const { botPick, botPts } = resolveBotAnswer(question);
      handleAnswer(pPts, botPts, botPick);
    }
  }, [selectedOption, showResult, currentIndex, questions, timeLeft, isLive]);

  const nextQuestion = () => {
    if (currentIndex + 1 >= questions.length) {
      endGame();
      return;
    }
    setCurrentIndex(prev => prev + 1);
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
    } catch {}
    router.replace(
      `/results?playerScore=${ps}&opponentScore=${bs}&opponentPseudo=${params.opponentPseudo}&category=${params.category}&userId=${userId}&isBot=${params.isBot}&correctCount=${cc}&opponentLevel=${ol}`
    );
  };

  if (loading || questions.length === 0) {
    const spinInterp = spinAnim.interpolate({
      inputRange: [0, 1], outputRange: ['0deg', '360deg'],
    });

    // Show error state
    if (loadError) {
      return (
        <SwipeBackPage>
        <View style={styles.container}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.loadingView}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorTitle}>Erreur de chargement</Text>
              <Text style={styles.errorMessage}>{loadError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchQuestions} activeOpacity={0.8}>
                <Text style={styles.retryBtnText}>Réessayer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtnLoading} onPress={() => router.back()} activeOpacity={0.8}>
                <Text style={styles.backBtnLoadingText}>Retour</Text>
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
                <Text style={styles.spinnerIcon}>🎯</Text>
              </Animated.View>
            </View>
            <Animated.Text style={[styles.loadingTitle, { opacity: pulseAnim }]}>
              Chargement des questions
            </Animated.Text>
            <Text style={styles.loadingSubtitle}>
              Récupération depuis la base de données...
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
    if (!showResult) return '#1A1A1A';
    if (isLive) {
      if (index === selectedOption) {
        return lastAnswerCorrectRef.current ? '#00C853' : '#FF3B30';
      }
      return '#999';
    }
    if (index === question.correct_option) return '#00C853';
    if (index === selectedOption) return '#FF3B30';
    return '#999';
  };

  const oneQPct = (1 / TOTAL_QUESTIONS) * 100; // ~14.3%

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
        }]} />
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
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{pseudo[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.playerMeta}>
              <Text style={styles.playerName} numberOfLines={1}>{pseudo}</Text>
              <Text style={styles.playerTitle}>Challenger</Text>
              <Text style={styles.playerScoreNum}>{playerScore}</Text>
            </View>
          </View>

          <View style={styles.timerCenter}>
            <Text style={styles.timerLabel}>Temps restant</Text>
            <View style={[styles.timerCircle, timeLeft <= 3 && styles.timerDanger]}>
              <Text style={[styles.timerNum, timeLeft <= 3 && styles.timerNumDanger]}>{timeLeft}</Text>
            </View>
          </View>

          <View style={styles.opponentInfo}>
            <View style={styles.playerMeta}>
              <Text style={[styles.playerName, { textAlign: 'right' }]} numberOfLines={1}>
                {params.opponentPseudo?.slice(0, 10)}
              </Text>
              <Text style={[styles.playerTitle, { textAlign: 'right' }]}>{isLive ? 'En ligne' : 'Bot'}</Text>
              <Text style={[styles.playerScoreNum, { textAlign: 'right' }]}>{botScore}</Text>
            </View>
            <View style={[styles.avatarCircle, styles.avatarBot]}>
              <Text style={styles.avatarLetter}>{(params.opponentPseudo || 'B')[0]?.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.questionCounter}>Question {currentIndex + 1}/{questions.length}</Text>

        {/* ── Main Area ── */}
        <View style={styles.gameArea}>
          {/* LEFT BAR (Player) */}
          <AnimatedBar score={playerScore} showPending={showPending} />

          {/* CENTER CONTENT */}
          <View style={styles.centerContent}>
            <Animated.View style={[styles.questionBox, { opacity: questionFade }]}>
              <Text style={styles.questionText}>{question.question_text}</Text>
            </Animated.View>

            <View style={styles.optionsBox}>
              {question.options.map((option, index) => {
                const isPlayerPick = selectedOption === index;
                const isBotPick = botAnswer === index;

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

                    <Text style={[styles.optionText, { color: getOptionTextColor(index) }]} numberOfLines={2}>
                      {option}
                    </Text>

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
          <AnimatedBar score={botScore} showPending={showPending} />
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
  spinnerIcon: { fontSize: 28 },
  spinnerDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#8A2BE2',
    position: 'absolute', top: 0, left: '50%', marginLeft: -4,
  },
  loadingTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  loadingSubtitle: { color: '#888', fontSize: 13, textAlign: 'center' },

  // Error state
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  errorMessage: { color: '#AAA', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  retryBtn: {
    backgroundColor: '#8A2BE2', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40,
    marginBottom: 12,
  },
  retryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  backBtnLoading: {
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  backBtnLoadingText: { color: '#888', fontSize: 14, fontWeight: '600' },

  // Progress bar (question advancement)
  progressBarBg: { height: 6, backgroundColor: '#333', width: '100%', borderRadius: 3, overflow: 'hidden' },
  progressBarSolid: {
    position: 'absolute', height: 6, backgroundColor: '#8A2BE2',
    borderRadius: 3,
  },
  progressBarPending: {
    position: 'absolute', height: 6,
    backgroundColor: 'rgba(138,43,226,0.35)',
    borderRadius: 3,
  },

  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  opponentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#8A2BE2',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff',
  },
  avatarBot: { backgroundColor: '#2196F3' },
  avatarLetter: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  playerMeta: { marginHorizontal: 8 },
  playerName: { color: '#FFF', fontSize: 13, fontWeight: '700', maxWidth: 80 },
  playerTitle: { color: '#888', fontSize: 10 },
  playerScoreNum: { color: '#00C853', fontSize: 20, fontWeight: '900' },

  // Timer
  timerCenter: { alignItems: 'center', paddingHorizontal: 8 },
  timerLabel: { color: '#888', fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  timerCircle: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: '#00BFFF',
    justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,191,255,0.1)',
  },
  timerDanger: { borderColor: '#FF3B30', backgroundColor: 'rgba(255,59,48,0.1)' },
  timerNum: { color: '#00BFFF', fontSize: 22, fontWeight: '900' },
  timerNumDanger: { color: '#FF3B30' },

  questionCounter: {
    color: '#666', fontSize: 11, fontWeight: '700', textAlign: 'center',
    textTransform: 'uppercase', letterSpacing: 2, paddingVertical: 6,
  },

  // Game area
  gameArea: { flex: 1, flexDirection: 'row' },

  // Score bars
  barColumn: { width: 18, paddingVertical: 12, alignItems: 'center' },
  barTrack: {
    width: 14, flex: 1, backgroundColor: '#2A2A2A',
    borderRadius: 7, overflow: 'hidden', position: 'relative',
  },

  // Center
  centerContent: { flex: 1, paddingHorizontal: 4 },
  questionBox: {
    paddingHorizontal: 16, paddingVertical: 16,
    justifyContent: 'center', alignItems: 'center', minHeight: 80,
  },
  questionText: { color: '#FFF', fontSize: 20, fontWeight: '800', textAlign: 'center', lineHeight: 28 },

  // Options
  optionsBox: { flex: 1, justifyContent: 'center', gap: 10, paddingBottom: 16, paddingHorizontal: 8 },
  optionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 8,
    paddingVertical: 16, paddingHorizontal: 20,
    justifyContent: 'center', alignItems: 'center',
    minHeight: 56, borderWidth: 1, borderColor: '#E0E0E0',
    position: 'relative', overflow: 'visible',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  optionText: { fontSize: 17, fontWeight: '800', textAlign: 'center', color: '#1A1A1A' },

  // Triangles
  triLeftAnchor: {
    position: 'absolute', left: -16, top: 0, bottom: 0,
    width: 16, justifyContent: 'center', alignItems: 'flex-end',
  },
  triLeft: {
    width: 0, height: 0,
    borderTopWidth: 14, borderTopColor: 'transparent',
    borderBottomWidth: 14, borderBottomColor: 'transparent',
    borderLeftWidth: 16, borderLeftColor: '#111',
  },
  triRightAnchor: {
    position: 'absolute', right: -16, top: 0, bottom: 0,
    width: 16, justifyContent: 'center', alignItems: 'flex-start',
  },
  triRight: {
    width: 0, height: 0,
    borderTopWidth: 14, borderTopColor: 'transparent',
    borderBottomWidth: 14, borderBottomColor: 'transparent',
    borderRightWidth: 16, borderRightColor: '#111',
  },
});
