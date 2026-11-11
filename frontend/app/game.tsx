import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, Animated, ScrollView, useWindowDimensions,
  Platform, UIManager, Easing, AppState, BackHandler, Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import SwipeBackPage from '../components/SwipeBackPage';
import RoundTimer from '../components/RoundTimer';
import Txt from '../components/ui/Txt';
import Icon from '../components/ui/Icon';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Loader from '../components/ui/Loader';
import Dialog from '../components/ui/Dialog';
import ScreenContainer from '../components/ui/ScreenContainer';
import { ReactionBubble, DuelReactionButton, ShownReaction } from '../components/Reactions';
import { botReactionFor, botReplyTo, getReactionsMuted } from '../utils/reactions';
import AnswerButton, { AnswerState, ANSWER_ROW_MIN_HEIGHT } from '../components/ui/AnswerButton';
import { useWS } from '../contexts/WebSocketContext';
import { dueloWS } from '../services/websocket';
import { COLOR, SPACE, RADII, BORDER, ELEVATION } from '../theme/tokens';
import { authFetch } from '../utils/api';
import { saveScoreWithRetry } from '../utils/pendingScores';
import { t, getLanguage } from '../utils/i18n';
import { preloadSounds, playSound } from '../utils/sounds';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const TIMER_DURATION = 10;

// Durée adaptée au volume de lecture (question + 4 réponses) — paliers 10/13/15 s.
// Déterministe : en PvP les deux clients reçoivent la même question, donc
// calculent la même durée — équité garantie sans synchronisation serveur.
// Le bonus vitesse reste calé sur le barème 10 s (au-delà : points de base).
function getQuestionDuration(q?: { question_text?: string; options?: string[] }): number {
  if (!q) return TIMER_DURATION;
  const total = (q.question_text?.length || 0)
    + (q.options || []).reduce((n, o) => n + (o?.length || 0), 0);
  return total > 300 ? 15 : total > 180 ? 13 : TIMER_DURATION;
}
const TOTAL_QUESTIONS = 7;
const MAX_PTS_PER_Q = 20;
// Durée minimale d'affichage du vert/rouge avant la question suivante (bot comme duel en ligne).
const REVEAL_MS = 2000;
// Temps laissé, une fois les deux réponses connues, pour voir l'avatar du rival sur sa case.
const OPPONENT_REVEAL_MS = 1600;
// Duel en ligne : la bonne réponse vient du serveur. Le jaune « en attente » ne s'affiche
// que si sa réponse tarde, sinon on passe directement au vert/rouge comme contre un bot.
const PENDING_PICK_DELAY_MS = 400;
const MAX_TOTAL = MAX_PTS_PER_Q * TOTAL_QUESTIONS; // 140

type Question = {
  id: string;
  question_text: string;
  options: string[];
  correct_option: number;
  difficulty?: string; // 'Facile' | 'Moyen' | 'Difficile'
};

// Hash FNV-1a → [0, 1) : traits stables d'un bot (affinité par thème, forme du jour)
function botHash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

// ── Présentation ──
const LETTERS = ['A', 'B', 'C', 'D'];
const TIMER_SIZE = 64; // anneau compact, centré entre les deux scores

// Question par paliers de longueur (Space Grotesk Bold) : 24/30 · 22/28 · 19/25 · 17/23.
// Le kit n'a pas encore de variante « question » : on part de h2 et on ajuste taille et interligne.
// Écran compact (hauteur < 700 : 320×568, 375×667…) : un palier plus bas, plancher 16/22.
const QUESTION_TIERS = [
  { size: 24, line: 30 },
  { size: 22, line: 28 },
  { size: 19, line: 25 },
  { size: 17, line: 23 },
  { size: 16, line: 22 },
];
const questionTier = (len: number, compact: boolean) => {
  const i = len <= 60 ? 0 : len <= 100 ? 1 : len <= 150 ? 2 : 3;
  return QUESTION_TIERS[Math.min(i + (compact ? 1 : 0), QUESTION_TIERS.length - 1)];
};
const COMPACT_HEIGHT = 700;

// ── Répartition verticale question / réponses ──
// Sous la rangée progression, deux zones en colonne :
//  · question : base = hauteur de son texte, poids de croissance 1, texte CENTRÉ dans sa zone
//    (V1.2 : le vide se répartit au-dessus et en dessous au lieu de s'accumuler sous la
//    question — 130 px mesurés en 390). En dernier recours elle rétrécit :
//    son texte est dans un ScrollView (jamais coupé, jamais sous les réponses) ;
//  · réponses : base = hauteur de leur contenu (jamais compressées), poids de croissance 2,
//    calées en bas (zone du pouce).
// L'espace libre va donc pour 2/3 aux réponses et 1/3 sous la question. Les rangées 2×2
// sont plafonnées à 1,6 × la largeur d'une tuile (tuile légèrement en portrait) ; au-delà, le surplus revient
// à la zone question (Yoga redistribue l'espace d'un élément plafonné).
const QUESTION_GROW = 1;
const ANSWERS_GROW = 2;
const TILE_RATIO_MAX = 1.6;

// ── Grille 2×2 ou liste 1×4 ──
// Largeur utile du texte d'une tuile 2×2 = (écran − 2×16 de marges − 8 d'écart) / 2 − 2×12 de padding
//   ≈ 151 px en 390, 143 en 375, 136 en 360, 116 en 320.
// En Space Grotesk SemiBold 16 px, un caractère moyen fait ≈ 0,56 em ≈ 9 px
//   → ≈ 16 caractères par ligne en 390/375, 15 en 360, 12 en 320.
// Règle : on bascule en liste 1×4 si AU MOINS UNE réponse
//   (a) dépasse 2 lignes de tuile (longueur > 2 × caractères/ligne : 32 en 390/375, 30 en 360,
//       24 en 320) — au-delà, la tuile tomberait à 14 px sur 3-4 lignes, lecture pénible ; ou
//   (b) contient un mot plus long qu'une ligne de tuile (sinon coupure au milieu du mot,
//       ex. « Constantinople » en 320).
// Exemples : « 4 », « 1990 », « La Machine volante » → 2×2 ;
//            « Le traité de Versailles signé en 1919 » (37 car.) → 1×4.
// Les quatre réponses passent toujours ensemble dans la même mise en page.
const CHAR_EM = 0.56;
const TILE_FONT = 16;
const tileCharsPerLine = (screenW: number) => {
  const textW = (screenW - SPACE.screenX * 2 - SPACE.sm) / 2 - SPACE.md * 2;
  return Math.max(8, Math.floor(textW / (TILE_FONT * CHAR_EM)));
};
const needsListLayout = (options: string[], screenW: number): boolean => {
  const cpl = tileCharsPerLine(screenW);
  return options.some((o) => {
    const txt = (o || '').trim();
    if (txt.length > cpl * 2) return true;
    return txt.split(/\s+/).some((w) => w.length > cpl);
  });
};

// Liste 1×4 : hauteur commune estimée pour que les quatre lignes soient égales.
// Largeur du texte = écran − marges − padding − lettre (24) − 2 écarts − colonne marqueurs (20).
// Taille 16/15/14 selon la longueur (même barème qu'AnswerButton), ≤ 4 lignes, +15 % de marge de césure.
const LETTER_BADGE = 24;
const MARKER_COL = 20;
const rowFont = (len: number) => (len > 90 ? 14 : len > 50 ? 15 : 16);
const ROW_MAX_GROW = 88; // une ligne courte ne s'étire pas au-delà
const listRowHeight = (options: string[], screenW: number, padV: number) => {
  const textW = screenW - SPACE.screenX * 2 - SPACE.md * 2 - LETTER_BADGE - SPACE.md * 2 - MARKER_COL;
  const h = options.reduce((max, o) => {
    const len = (o || '').length;
    const fs = rowFont(len);
    const cpl = Math.max(8, Math.floor(textW / (fs * CHAR_EM)));
    const lines = Math.min(4, Math.max(1, Math.ceil((len * 1.15) / cpl)));
    return Math.max(max, lines * (fs + 5) + padV * 2 + 2 * BORDER.default);
  }, 0);
  return Math.max(ANSWER_ROW_MIN_HEIGHT, Math.ceil(h));
};

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category: string; opponentPseudo: string; opponentSeed: string; opponentAvatarUrl: string; isBot: string; roomId: string; opponentLevel: string; opponentId: string;
    challenge_id: string; asyncChallenge: string; asyncMode: string;
    botSkill: string; botSpeed: string;
  }>();
  const { send: wsSend, on: wsOn } = useWS();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const themeId = params.category;
  // Marqueur posé sur la réponse du rival : sa photo, sinon son initiale dans son cercle (comme au VS).
  const opponentAvatar = useMemo(() => ({
    seed: params.opponentSeed, url: params.opponentAvatarUrl || null, pseudo: params.opponentPseudo,
  }), [params.opponentSeed, params.opponentAvatarUrl, params.opponentPseudo]);
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
  const [questionDuration, setQuestionDuration] = useState(TIMER_DURATION);
  const questionDurationRef = useRef(TIMER_DURATION);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState(t('game.player'));
  const [showPending, setShowPending] = useState(true);
  const [pendingPickVisible, setPendingPickVisible] = useState(false);

  // Score refs to avoid stale closures
  const playerScoreRef = useRef(0);
  const botScoreRef = useRef(0);
  const correctCountRef = useRef(0);
  const opponentLevelRef = useRef(1);
  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);

  // Progress bar state (questions)
  const [completedQuestions, setCompletedQuestions] = useState(0);
  // Affichage seul : juste/faux par question pour colorer les tirets de progression
  const questionResultsRef = useRef<Record<number, boolean>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLeftRef = useRef(TIMER_DURATION);
  const answeredRef = useRef(false);   // réponse donnée à la question en cours
  const questionsRef = useRef<Question[]>([]);
  const currentIndexRef = useRef(0);
  const questionFade = useRef(new Animated.Value(0)).current;
  const questionSlide = useRef(new Animated.Value(24)).current;
  const userIdRef = useRef<string | null>(null);
  const lastAnswerCorrectRef = useRef(false);
  // Bonne réponse renvoyée par le serveur après notre réponse (null si serveur ancien / pas de réponse)
  const lastCorrectOptionRef = useRef<number | null>(null);

  // Async challenge tracking
  type AnswerRecord = { answer: number; is_correct: boolean; points: number; time_ms: number };
  const playerAnswersHistoryRef = useRef<AnswerRecord[]>([]);
  const p1AnswersRef = useRef<{ answer: number; is_correct: boolean; points: number }[]>([]);

  // Per-question player selections for the results "review missed" feature (all modes)
  const playerSelectionsRef = useRef<Record<number, number>>({});

  // Guards
  const isSubmittingRef = useRef(false);               // #18 double-tap prevention
  const wsAnswerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // #17 WS hang timeout
  const pendingPickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Duel en ligne : quand le second joueur répond, le serveur envoie la question suivante
  // aussitôt après son résultat. On la retient pour laisser le vert/rouge à l'écran.
  const revealedAtRef = useRef(0);
  const afterRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const afterReveal = (fn: () => void) => {
    if (afterRevealTimerRef.current) clearTimeout(afterRevealTimerRef.current);
    const wait = REVEAL_MS - (Date.now() - revealedAtRef.current);
    if (wait > 0) afterRevealTimerRef.current = setTimeout(fn, wait);
    else fn();
  };

  // Question slide scale animation
  const questionScaleAnim = useRef(new Animated.Value(0.96)).current;

  // Anti-triche : garde de fin de match (évite double navigation + pilote le forfait)
  const matchEndedRef = useRef(false);

  // « Revoir mes erreurs » (results.tsx) lit les questions du dernier match dans AsyncStorage.
  // On purge au démarrage et on enregistre à CHAQUE fin de match (solo, duel en ligne,
  // forfait, adversaire parti) : sinon l'écran montrait les questions d'une partie précédente.
  useEffect(() => {
    AsyncStorage.multiRemove(['duelo_last_quiz_questions', 'duelo_last_player_answers']).catch(() => {});
  }, []);
  const saveReviewData = async () => {
    try {
      const qs = questionsRef.current;
      if (qs.length === 0) return;
      const selections = qs.map((_, i) =>
        playerSelectionsRef.current[i] !== undefined ? playerSelectionsRef.current[i] : -1
      );
      await AsyncStorage.multiSet([
        ['duelo_last_quiz_questions', JSON.stringify(qs)],
        ['duelo_last_player_answers', JSON.stringify(selections)],
      ]);
    } catch (e) { console.error(e); }
  };

  // ⚔️ Quitter l'app en plein match = FORFAIT immédiat — bot compris.
  // Sinon on peut mettre l'app en fond, chercher la réponse et revenir.
  // Déclenché sur 'background' uniquement (pas 'inactive' : centre de
  // contrôle / appel entrant ne doivent pas coûter le match).
  const forfeit = () => {
    if (matchEndedRef.current || questionsRef.current.length === 0) return;
    matchEndedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    const ps = playerScoreRef.current;
    // Défaite garantie, peu importe le score au moment de l'abandon
    const forfeitOpp = Math.max(botScoreRef.current, ps + 10);
    saveReviewData().then(() => AsyncStorage.getItem('duelo_user_id')).then((userId) => {
      router.replace(
        `/results?playerScore=${ps}&opponentScore=${forfeitOpp}&opponentPseudo=${params.opponentPseudo}&category=${params.category}&userId=${userId || ''}&isBot=${params.isBot}&correctCount=${correctCountRef.current}&opponentLevel=${parseInt(params.opponentLevel || '1') || 1}&opponentId=${params.opponentId || ''}`
      );
    });
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background') return;
      forfeit();
    });
    return () => sub.remove();
  }, []);

  // Abandon volontaire (bouton ✕ ou retour Android) : même forfait, mais confirmé.
  // Le swipe-retour est désactivé en match : on ne quitte plus une partie par accident.
  // Confirmation dans la modale du kit (plus d'Alert natif ni de window.confirm sur le web).
  const [forfeitAsk, setForfeitAsk] = useState(false);
  const confirmForfeit = () => {
    if (matchEndedRef.current) return;
    if (questionsRef.current.length === 0) { router.back(); return; }
    setForfeitAsk(true);
  };

  useEffect(() => {
    if (Platform.OS === 'web') return; // pas de bouton retour matériel sur le web
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmForfeit();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Score pop : scale 1 → 1.4 → 1 sur bonne réponse joueur
  const scorePopAnim = useRef(new Animated.Value(1)).current;
  const triggerScorePop = () => {
    scorePopAnim.setValue(1);
    Animated.sequence([
      Animated.spring(scorePopAnim, { toValue: 1.4, useNativeDriver: true, speed: 20, bounciness: 14 }),
      Animated.spring(scorePopAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 10 }),
    ]).start();
  };

  // Correct streak streak toast
  const [correctStreak, setCorrectStreak] = useState(0);
  const correctStreakRef = useRef(0);
  // ── Réactions pendant le duel (direct et bots ; pas en défi différé) ──
  const reactionsOn = !isAsync;
  const [myReaction, setMyReaction] = useState<ShownReaction | null>(null);
  const [oppReaction, setOppReaction] = useState<ShownReaction | null>(null);
  const [reactedQ, setReactedQ] = useState<number | null>(null);   // une réaction par question
  const [oppMuted, setOppMuted] = useState(false);                  // toucher le score adverse = sourdine
  const oppMutedRef = useRef(false);
  const botReactionsRef = useRef(0);
  const reactionSeq = useRef(0);
  useEffect(() => { getReactionsMuted().then((m) => { oppMutedRef.current = m; setOppMuted(m); }); }, []);
  const showOppReaction = (key: string) => {
    if (oppMutedRef.current || matchEndedRef.current) return;
    setOppReaction({ key, id: ++reactionSeq.current });
  };
  const toggleOppMute = () => {
    const next = !oppMutedRef.current;
    oppMutedRef.current = next;
    setOppMuted(next);
    Haptics.selectionAsync();
    if (next) setOppReaction(null);
  };
  const sendDuelReaction = (key: string) => {
    const q = currentIndexRef.current;
    if (reactedQ === q) return;
    setReactedQ(q);
    setMyReaction({ key, id: ++reactionSeq.current });
    if (isLive) {
      wsSend({ action: 'game_reaction', room_id: params.roomId, key });
    } else {
      // Le bot répond parfois, comme un vrai joueur
      const reply = botReplyTo(key, botScoreRef.current > playerScoreRef.current);
      if (reply && ['laugh', 'fire', 'shock', 'clap'].includes(reply)) {
        setTimeout(() => showOppReaction(reply), 900 + Math.random() * 900);
      }
    }
  };

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

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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
        dueloWS.takeGameStart(params.roomId as string);
        applyGameStart(msg);
      }),
      // Our answer result
      wsOn('answer_result', (msg) => {
        // #17 clear hang timeout, #18 reset submission guard
        if (wsAnswerTimeoutRef.current) clearTimeout(wsAnswerTimeoutRef.current);
        if (pendingPickTimerRef.current) clearTimeout(pendingPickTimerRef.current);
        setPendingPickVisible(false);
        revealedAtRef.current = Date.now();
        isSubmittingRef.current = false;

        const { is_correct, points, your_score, opponent_score, question_index, correct_option } = msg.data || {};
        lastAnswerCorrectRef.current = is_correct;
        lastCorrectOptionRef.current = typeof correct_option === 'number' ? correct_option : null;
        // En duel, le serveur ne révèle la bonne réponse qu'ici : on la garde pour « Revoir mes erreurs ».
        const answeredQ = questionsRef.current[question_index];
        if (answeredQ && typeof correct_option === 'number') {
          questionsRef.current[question_index] = { ...answeredQ, correct_option };
        }
        playerScoreRef.current = your_score;
        botScoreRef.current = opponent_score;
        setPlayerScore(your_score);
        setBotScore(opponent_score);
        if (is_correct) { correctCountRef.current += 1; triggerScorePop(); }

        setShowResult(true);
        setShowPending(false);

        const done = question_index + 1;
        questionResultsRef.current[question_index] = !!is_correct;
        setCompletedQuestions(done);

        Haptics.notificationAsync(
          is_correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
        );
        playSound(is_correct ? 'correct' : 'wrong');
      }),
      // Les deux ont répondu : le serveur révèle la case choisie par l'adversaire, puis marque
      // une pause commune avant la question suivante.
      wsOn('game_reaction', (msg) => {
        const key = msg.data?.key;
        if (typeof key === 'string') showOppReaction(key);
      }),
      wsOn('question_reveal', (msg) => {
        const { question_index, opponent_answer } = msg.data || {};
        if (question_index !== currentIndexRef.current) return;
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (typeof opponent_answer === 'number' && opponent_answer >= 0) setBotAnswer(opponent_answer);
        revealedAtRef.current = Math.max(revealedAtRef.current, Date.now() - REVEAL_MS + OPPONENT_REVEAL_MS);
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
      wsOn('next_question', (msg) => afterReveal(() => {
        const q = msg.data?.question;
        if (q) {
          questionsRef.current = [...questionsRef.current, q];
          currentIndexRef.current = msg.data.question_index;
          setQuestions(questionsRef.current);
          setCurrentIndex(msg.data.question_index);
          setSelectedOption(null);
          setBotAnswer(null);
          setShowResult(false);
          lastCorrectOptionRef.current = null;
          setShowPending(true);
          animateQuestion();
          startTimer();
        }
      })),
      // Game over
      wsOn('game_over', (msg) => {
        matchEndedRef.current = true;
        if (timerRef.current) clearInterval(timerRef.current);
        afterReveal(async () => {
          const { your_score, opponent_score, your_correct } = msg.data || {};
          const userId = userIdRef.current;
          playSound(your_score >= opponent_score ? 'victory' : 'defeat');
          await saveReviewData();
          router.replace(
            `/results?playerScore=${your_score}&opponentScore=${opponent_score}&opponentPseudo=${params.opponentPseudo}&category=${params.category}&userId=${userId}&isBot=false&correctCount=${your_correct || correctCountRef.current}&opponentLevel=${params.opponentLevel || 1}&opponentId=${params.opponentId || ''}`
          );
        });
      }),
      // Opponent disconnected
      wsOn('opponent_disconnected', async (msg) => {
        if (afterRevealTimerRef.current) clearTimeout(afterRevealTimerRef.current);
        matchEndedRef.current = true;
        if (timerRef.current) clearInterval(timerRef.current);
        const { your_score, opponent_score, your_correct, compensation_points } = msg.data || {};
        // Navigate to results with auto-victory
        const userId = userIdRef.current;
        await saveReviewData();
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

    // game_start a pu arriver pendant l'animation VS, avant que cet écran n'écoute.
    const pendingStart = dueloWS.takeGameStart(params.roomId as string);
    if (pendingStart) applyGameStart(pendingStart);

    return () => {
      unsubs.forEach((u) => u());
      if (afterRevealTimerRef.current) clearTimeout(afterRevealTimerRef.current);
      if (pendingPickTimerRef.current) clearTimeout(pendingPickTimerRef.current);
    };
  // #38 — isLive is derived from URL params (never changes), use [] to prevent listener leak on re-render
  }, []);

  function applyGameStart(msg: { data?: any }) {
    const q = msg.data?.question;
    if (!q || questionsRef.current.length > 0) return;
    questionsRef.current = [q];
    currentIndexRef.current = 0;
    setQuestions([q]);
    setLoading(false);
    animateQuestion();
    startTimer();
  }

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
      // LANGUE DES QUESTIONS. Deux sources, dans cet ordre :
      //   1. le mode VO (thèmes SCREEN) force l'anglais — c'est un choix explicite du
      //      joueur « je veux les répliques dans la langue du film », indépendant de la
      //      langue de l'interface ;
      //   2. sinon on suit la langue de l'app.
      // Le serveur vérifie thème par thème que la langue existe et retombe sur le
      // français sinon : un thème non traduit reste donc jouable, sans rien casser.
      const voFlag = await AsyncStorage.getItem(`duelo_vo_${params.category}`);
      const lang = voFlag === 'true' ? 'en' : getLanguage();
      const langParam = lang && lang !== 'fr' ? `&lang=${lang}` : '';
      const url = `${API_URL}/api/game/questions-v2?theme=${params.category}${langParam}`;
      const res = await authFetch(url);
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
    // Durée calculée sur la question COURANTE (lue via les refs — jamais le state)
    const duration = getQuestionDuration(questionsRef.current[currentIndexRef.current]);
    questionDurationRef.current = duration;
    setQuestionDuration(duration);
    timeLeftRef.current = duration;
    setTimeLeft(duration);

    answeredRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      const remaining = timeLeftRef.current;
      setTimeLeft(remaining);
      if (remaining <= 3 && remaining > 0) playSound('tick');
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        // Déjà répondu (duel en direct) : le chrono a seulement fini de défiler pour l'adversaire.
        if (!answeredRef.current) handleTimeout();
      }
    }, 1000);
  };

  const resolveBotAnswer = (question: Question) => {
    // Use real bot stats from DB if available, otherwise fall back to defaults
    const baseSkill = parseFloat(params.botSkill || '') || 0.55;
    const avgSpeed  = parseFloat(params.botSpeed || '') || 5.0;
    const pseudo    = params.opponentPseudo || '';

    // Un humain n'a pas le même niveau partout : affinité stable par (bot, thème)
    // ±0,12, plus une « forme du jour » ±0,04. Déterministe → le même bot reste
    // fort (ou faible) sur un thème donné d'un match à l'autre.
    const themeAffinity = (botHash01(`${pseudo}|${params.category}`) - 0.5) * 0.24;
    const dayForm = (botHash01(`${pseudo}|${new Date().toISOString().slice(0, 10)}`) - 0.5) * 0.08;
    // Seul le palier Facile est fiable (audit SCREEN 28/07) : Moyen ≈ Difficile.
    const diffMod = question.difficulty === 'Facile' ? 0.10 : question.difficulty === 'Difficile' ? -0.05 : 0;
    const pCorrect = Math.max(0.05, Math.min(0.97, baseSkill + themeAffinity + dayForm + diffMod));

    const qDuration = getQuestionDuration(question);
    const readScale = qDuration / TIMER_DURATION; // le bot « lit » lui aussi les pavés

    // Rare non-réponse (laisse filer le chrono), plus fréquente chez les faibles
    if (Math.random() < 0.06 * (1 - pCorrect)) {
      return { botPick: -1, botPts: 0, botTimeMs: qDuration * 1000 };
    }

    const botCorrect = Math.random() < pCorrect;

    // Temps log-normal (asymétrique : beaucoup de réponses autour de la moyenne,
    // une traîne d'hésitations). Une erreur prend en moyenne plus de temps,
    // une question facile moins.
    const gauss = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
    let botTimeSec = avgSpeed * Math.exp(0.38 * gauss - 0.07);
    if (!botCorrect) botTimeSec *= 1.25;
    if (question.difficulty === 'Facile') botTimeSec *= 0.85;
    botTimeSec *= readScale;
    botTimeSec = Math.max(1.1 * readScale, Math.min(qDuration - 0.4, botTimeSec));
    const botTimeMs = Math.round(botTimeSec * 1000);

    if (botCorrect) {
      const speedBonus = Math.max(0, Math.round(10 * (1 - botTimeMs / 10000)));
      return { botPick: question.correct_option, botPts: Math.max(10 + speedBonus, 10), botTimeMs };
    }
    // Erreur humaine = leurre plausible : on pondère les mauvaises options par
    // leur proximité de longueur avec la bonne réponse (proxy de vraisemblance).
    const correctLen = (question.options[question.correct_option] || '').length || 1;
    const wrongOpts = [0, 1, 2, 3].filter(i => i !== question.correct_option && i < question.options.length);
    const weights = wrongOpts.map(i => {
      const len = (question.options[i] || '').length || 1;
      return 1 / (1 + Math.abs(Math.log(len / correctLen)) * 2);
    });
    let rw = Math.random() * weights.reduce((a, b) => a + b, 0);
    let botPick = wrongOpts[wrongOpts.length - 1];
    for (let k = 0; k < wrongOpts.length; k++) {
      rw -= weights[k];
      if (rw <= 0) { botPick = wrongOpts[k]; break; }
    }
    return { botPick, botPts: 0, botTimeMs };
  };

  const handleAnswer = (pPts: number, bPts: number, botPick: number, botRevealDelay?: number) => {
    const newP = playerScoreRef.current + pPts;
    const newB = botScoreRef.current + bPts;
    playerScoreRef.current = newP;
    botScoreRef.current = newB;
    setPlayerScore(newP);
    setBotScore(newB);
    if (pPts > 0) triggerScorePop();

    // Hide pending on bars (answered)
    setShowPending(false);

    // Progression : question terminée
    const done = completedQuestions + 1;
    setCompletedQuestions(done);

    // Reveal bot answer with a small independent delay (simulates opponent responding
    // at their own pace rather than instantly when the player answers)
    // Puis une pause une fois les deux réponses visibles, pour voir la case choisie par le rival.
    const delay = botRevealDelay ?? 0;
    setTimeout(() => setBotAnswer(botPick), delay);
    // Bot : une réaction de temps en temps (3 max par match), cohérente avec la question
    if (reactionsOn && !isLive && botReactionsRef.current < 3) {
      const r = botReactionFor(bPts > 0, pPts > 0);
      if (r) {
        botReactionsRef.current += 1;
        setTimeout(() => showOppReaction(r), delay + 350 + Math.random() * 500);
      }
    }

    setTimeout(nextQuestion, Math.max(REVEAL_MS, delay + OPPONENT_REVEAL_MS));
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
        time_ms: questionDurationRef.current * 1000,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      setShowResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playSound('wrong');
      const question = questionsRef.current[currentIndexRef.current];
      if (!question) return;
      questionResultsRef.current[currentIndexRef.current] = false;

      // Record timeout to history for async modes
      if (isAsync) {
        playerAnswersHistoryRef.current.push({
          answer: -1,
          is_correct: false,
          points: 0,
          time_ms: questionDurationRef.current * 1000,
        });
      }

      if (isAsyncReveal) {
        const p1 = p1AnswersRef.current[currentIndexRef.current];
        handleAnswer(0, p1?.points ?? 0, p1?.answer ?? -1);
      } else {
        const { botPick, botPts, botTimeMs } = resolveBotAnswer(question);
        // Simulate bot answering independently: reveal after a natural-looking delay
        const playerTimeMs = questionDurationRef.current * 1000;
        const revealDelay = botTimeMs < playerTimeMs ? 0 : Math.min(botTimeMs - playerTimeMs, 1400);
        handleAnswer(0, botPts, botPick, revealDelay);
      }
    }
  };

  const selectAnswer = useCallback((optionIndex: number) => {
    if (selectedOption !== null || showResult) return;
    if (isSubmittingRef.current) return; // #18 double-tap guard
    isSubmittingRef.current = true;
    answeredRef.current = true;
    // En direct, le chrono continue de défiler tant que l'adversaire n'a pas répondu
    // (on voit le temps qu'il lui reste) ; il s'arrête à la révélation des deux réponses.
    if (!isLive && timerRef.current) clearInterval(timerRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedOption(optionIndex);
    playerSelectionsRef.current[currentIndexRef.current] = optionIndex;

    const timeTaken = questionDurationRef.current - timeLeftRef.current;
    const timeMs = timeTaken * 1000;

    if (isLive) {
      // Live multiplayer: send answer to server, wait for answer_result
      if (pendingPickTimerRef.current) clearTimeout(pendingPickTimerRef.current);
      pendingPickTimerRef.current = setTimeout(() => setPendingPickVisible(true), PENDING_PICK_DELAY_MS);
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
        setPendingPickVisible(false);
        setShowResult(true);
        setShowPending(false);
        isSubmittingRef.current = false;
        // Server never replied — advance after 2s so the game isn't stuck forever
        setTimeout(() => nextQuestion(), REVEAL_MS);
      }, 8000);
      // Don't show result locally — wait for server response
    } else {
      // Bot mode: resolve locally
      setShowResult(true);
      // #9 — keep guard locked until nextQuestion() so rapid double-taps are blocked
      const question = questions[currentIndex];
      const isCorrect = optionIndex === question.correct_option;
      const pPts = isCorrect ? Math.max(MAX_PTS_PER_Q - timeTaken, 10) : 0;
      questionResultsRef.current[currentIndexRef.current] = isCorrect;

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

    animateQuestion();
    startTimer();
  };

  const endGame = async () => {
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    const userId = await AsyncStorage.getItem('duelo_user_id');
    const ps = playerScoreRef.current;
    const bs = botScoreRef.current;
    playSound(ps >= bs ? 'victory' : 'defeat');
    const cc = correctCountRef.current;
    const ol = parseInt(params.opponentLevel || '1') || 1;
    await saveReviewData();
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
          `/results?playerScore=${ps}&opponentScore=${opponentFinalScore}&opponentPseudo=${params.opponentPseudo}&category=${params.category}&userId=${userId}&isBot=false&correctCount=${cc}&opponentLevel=1&opponentId=${params.opponentId || ''}`
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
    // Invalid params — guard after all hooks
    if (!themeId) {
      // Paramètres invalides : même gabarit que l'erreur de chargement (plus d'Alert pendant le rendu)
      return (
        <SwipeBackPage>
        <ScreenContainer safeTop safeBottom>
          <View style={styles.stateView}>
            <Icon name="error" size={40} color={COLOR.status.error} />
            <Txt variant="h2" align="center">{t('game.invalid_game')}</Txt>
            <View style={styles.stateActions}>
              <Button label={t('common.ok')} onPress={() => router.replace('/(tabs)/play')} haptic={false} fullWidth />
            </View>
          </View>
        </ScreenContainer>
        </SwipeBackPage>
      );
    }

    // Show error state
    if (loadError) {
      return (
        <SwipeBackPage>
        <ScreenContainer safeTop safeBottom>
          <View style={styles.stateView}>
            <Icon name="error" size={40} color={COLOR.status.error} />
            <Txt variant="h2" align="center">{t('game.loading_error')}</Txt>
            <Txt variant="body" color={COLOR.text.secondary} align="center" style={styles.errorMessage}>{loadError}</Txt>
            <View style={styles.stateActions}>
              <Button label={t('common.retry')} icon="replay" onPress={fetchQuestions} haptic={false} fullWidth />
              <Button label={t('common.back')} icon="back" variant="ghost" onPress={() => router.back()} haptic={false} fullWidth />
            </View>
          </View>
        </ScreenContainer>
        </SwipeBackPage>
      );
    }

    // Loading
    return (
      <SwipeBackPage enabled={false}>
      <ScreenContainer safeTop safeBottom>
        <Loader label={t('game.loading_questions')} fill />
      </ScreenContainer>
      </SwipeBackPage>
    );
  }

  const question = questions[currentIndex];
  const optionRows: Array<[number, number]> = [[0, 1], [2, 3]];
  // En live, les questions arrivent une par une : le total affiché reste celui du match.
  const totalShown = isLive ? TOTAL_QUESTIONS : questions.length;
  const compact = screenH < COMPACT_HEIGHT;
  const qTier = questionTier(question.question_text?.length || 0, compact);
  const options = [0, 1, 2, 3].map((i) => question.options?.[i] || '');
  const listLayout = needsListLayout(options, screenW);
  // Grille : rangées plafonnées à 1,25 × la largeur d'une tuile.
  const tileW = (screenW - SPACE.screenX * 2 - SPACE.sm) / 2;
  const gridRowMax = Math.round(tileW * TILE_RATIO_MAX);
  const answersPadBottom = compact ? SPACE.sm : SPACE.md;
  const gridMax = gridRowMax * 2 + SPACE.sm + answersPadBottom;
  // Liste : hauteur commune ; peut grandir jusqu'à 88 px (ou sa hauteur estimée si elle est plus grande).
  const rowPadV = compact ? SPACE.xs + SPACE.xxs : SPACE.sm;
  const listRowMin = listLayout ? listRowHeight(options, screenW, rowPadV) : ANSWER_ROW_MIN_HEIGHT;
  const listRowMax = Math.max(ROW_MAX_GROW, Math.round(listRowMin * 1.35));

  // Sémantique : neutre avant réponse · jaune = ma sélection (en attente) ·
  // vert + ✓ = bonne réponse révélée · rouge + ✕ = ma mauvaise réponse.
  const correctIndex = (): number | null => {
    if (!showResult) return null;
    if (!isLive) return question.correct_option;
    if (lastCorrectOptionRef.current !== null) return lastCorrectOptionRef.current;
    return lastAnswerCorrectRef.current ? selectedOption : null;
  };
  const isOptionCorrectReveal = (index: number): boolean => index === correctIndex();
  const isWrongPick = (index: number): boolean =>
    showResult && index === selectedOption && !isOptionCorrectReveal(index);
  const isPendingPick = (index: number): boolean =>
    !showResult && index === selectedOption && (!isLive || pendingPickVisible);

  const answerState = (index: number): AnswerState =>
    isOptionCorrectReveal(index) ? 'correct'
    : isWrongPick(index) ? 'wrong'
    : isPendingPick(index) ? 'selected'
    : showResult ? 'dimmed'
    : 'idle';

  // Tirets : vert = juste · rouge = faux · jaune = question en cours · crème 12 % = à venir
  const dashColor = (i: number): string => {
    if (i < completedQuestions) {
      const r = questionResultsRef.current[i];
      return r === true ? COLOR.status.success : r === false ? COLOR.status.error : COLOR.border.strong;
    }
    return i === currentIndex ? COLOR.action.primary : COLOR.track;
  };

  return (
    <SwipeBackPage enabled={false}>
    <ScreenContainer safeTop safeBottom>

      {/* Rangée haute : abandon (le swipe-retour est désactivé en match) + scores + timer */}
      <View style={styles.topRow}>
        <IconButton
          testID="forfeit-btn"
          icon="close"
          onPress={confirmForfeit}
          accessibilityLabel={t('game.forfeit')}
        />

        <View style={[styles.scoreBox, styles.scoreBoxSelf]} accessibilityLabel={`${pseudo} ${playerScore}`}>
          <Txt variant="overline" color={COLOR.player.self} numberOfLines={1}>{pseudo}</Txt>
          <Animated.View style={{ transform: [{ scale: scorePopAnim }] }}>
            <Txt variant="score">{playerScore}</Txt>
          </Animated.View>
        </View>

        <RoundTimer timeLeft={timeLeft} total={questionDuration} size={TIMER_SIZE} />

        <Pressable
          style={[styles.scoreBox, styles.scoreBoxOpponent]}
          accessibilityLabel={`${params.opponentPseudo || ''} ${isAsyncSolo ? '' : botScore}`}
          onPress={reactionsOn ? toggleOppMute : undefined}
          disabled={!reactionsOn}
        >
          <View style={styles.oppNameRow}>
            {reactionsOn && oppMuted ? <Icon name="eyeOff" size={12} color={COLOR.player.opponentText} /> : null}
            <Txt variant="overline" color={COLOR.player.opponentText} numberOfLines={1}>
              {params.opponentPseudo?.slice(0, 10)}
            </Txt>
          </View>
          <Txt variant="score">{isAsyncSolo ? '—' : botScore}</Txt>
        </Pressable>

        {/* Bulles de réaction, sous chaque score */}
        <ReactionBubble reaction={myReaction} side="self" style={styles.bubbleSelf} />
        <ReactionBubble reaction={oppReaction} side="opponent" style={styles.bubbleOpponent} />
      </View>

      {/* Progression : 7 tirets sémantiques + compteur */}
      <View style={styles.progressRow}>
        <View style={styles.dashes}>
          {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
            <View key={i} style={[styles.dash, { backgroundColor: dashColor(i) }]} />
          ))}
        </View>
        <Txt variant="overline" color={COLOR.text.secondary}>
          {t('pilot.game.question_counter', { n: String(currentIndex + 1), total: String(totalShown) })}
        </Txt>
        {/* Réaction : seulement une fois ma réponse donnée (jamais de temps perdu), une par question */}
        {reactionsOn && (selectedOption !== null || showResult) && reactedQ !== currentIndex ? (
          <DuelReactionButton key={currentIndex} onSend={sendDuelReaction} />
        ) : reactionsOn ? <View style={styles.reactionSlot} /> : null}
      </View>

      {/* Question, posée sur le fond (sans carte), calée en haut de sa zone */}
      <View style={[styles.questionZone, { flexGrow: QUESTION_GROW }]}>
        <ScrollView
          style={styles.questionScroll}
          contentContainerStyle={[styles.questionContent, compact && styles.questionContentCompact]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{
            opacity: questionFade,
            transform: [{ translateX: questionSlide }, { scale: questionScaleAnim }],
          }}>
            <Txt variant="h2" align="center" style={{ fontSize: qTier.size, lineHeight: qTier.line }}>
              {question.question_text}
            </Txt>
          </Animated.View>
        </ScrollView>
      </View>

      {/* Réponses dans la zone du pouce : grille 2×2, ou liste 1×4 si une réponse est longue */}
      {listLayout ? (
        <View style={[styles.answersZone, { flexGrow: ANSWERS_GROW, paddingBottom: answersPadBottom }]}>
          {options.map((opt, index) => (
            <AnswerButton
              key={index}
              testID={`option-${index}`}
              layout="row"
              letter={LETTERS[index]}
              text={opt}
              state={answerState(index)}
              opponentPick={showResult && botAnswer === index}
              opponentAvatar={opponentAvatar}
              onPress={() => selectAnswer(index)}
              disabled={showResult}
              style={[styles.listRow, { minHeight: listRowMin, maxHeight: listRowMax, paddingVertical: rowPadV }]}
            />
          ))}
        </View>
      ) : (
        <View style={[styles.answersZone, { flexGrow: ANSWERS_GROW, maxHeight: gridMax, paddingBottom: answersPadBottom }]}>
          {optionRows.map((row, rowIdx) => (
            <View key={rowIdx} style={[styles.optionsRow, { maxHeight: gridRowMax }]}>
              {row.map((index) => (
                <AnswerButton
                  key={index}
                  testID={`option-${index}`}
                  letter={LETTERS[index]}
                  text={options[index]}
                  state={answerState(index)}
                  opponentPick={showResult && botAnswer === index}
              opponentAvatar={opponentAvatar}
                  onPress={() => selectAnswer(index)}
                  disabled={showResult}
                />
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Toast de série */}
      {streakToastVisible && (
        <View style={styles.streakToastWrapper} pointerEvents="none">
          <Animated.View style={[styles.streakToast, {
            opacity: streakToastAnim,
            transform: [{ scale: streakToastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          }]}>
            <Icon name="flame" size={24} color={COLOR.text.onAction} />
            <Txt variant="h2" color={COLOR.text.onAction}>
              {streakToastCount === 7 ? t('pilot.game.streak_perfect') : t('pilot.game.streak', { n: String(streakToastCount) })}
            </Txt>
          </Animated.View>
        </View>
      )}

      {/* Abandon volontaire : confirmation explicite, le duel continue si on referme */}
      <Dialog
        visible={forfeitAsk}
        onClose={() => setForfeitAsk(false)}
        icon="warning"
        title={t('game.forfeit_title')}
        message={t('game.forfeit_body')}
        actions={
          <>
            <Button
              label={t('game.forfeit')}
              variant="danger"
              fullWidth
              testID="forfeit-confirm"
              onPress={() => { setForfeitAsk(false); forfeit(); }}
            />
            <Button label={t('pilot.game.keep_playing')} variant="ghost" fullWidth onPress={() => setForfeitAsk(false)} />
          </>
        }
      />
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  // États chargement / erreur
  stateView: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.xxxl, gap: SPACE.md },
  errorMessage: { marginBottom: SPACE.md },
  stateActions: { alignSelf: 'stretch', gap: SPACE.md },

  // Rangée haute : abandon + scores + timer
  oppNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xxs, maxWidth: '100%' },
  bubbleSelf: { left: SPACE.screenX + 48, top: '100%', marginTop: SPACE.xs },
  bubbleOpponent: { right: SPACE.screenX, top: '100%', marginTop: SPACE.xs },
  reactionSlot: { width: 36, height: 36 },
  topRow: {
    zIndex: 40,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACE.screenX, paddingTop: SPACE.xs, gap: SPACE.sm,
  },
  scoreBox: {
    flex: 1, minWidth: 0,
    backgroundColor: COLOR.surface.card,
    borderRadius: RADII.md, borderWidth: BORDER.strong,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
  },
  scoreBoxSelf: { borderColor: COLOR.player.self, alignItems: 'flex-start' },
  scoreBoxOpponent: { borderColor: COLOR.player.opponent, alignItems: 'flex-end' },

  // Progression
  progressRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingHorizontal: SPACE.screenX, paddingTop: SPACE.md,
  },
  dashes: { flex: 1, flexDirection: 'row', gap: SPACE.xs },
  dash: { flex: 1, height: SPACE.xs, borderRadius: RADII.xs },

  // Question : base = contenu, croissance QUESTION_GROW, texte centré ; rétrécit en dernier
  // recours (minHeight 0) et défile alors au lieu de chevaucher les réponses.
  questionZone: { flexShrink: 1, flexBasis: 'auto', minHeight: 0, justifyContent: 'center' },
  questionScroll: { flexGrow: 0, flexShrink: 1 },
  questionContent: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.xl, paddingBottom: SPACE.lg },
  questionContentCompact: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.md },

  // Réponses : base = contenu (jamais compressées), croissance ANSWERS_GROW, calées en bas
  answersZone: {
    flexShrink: 0, flexBasis: 'auto', justifyContent: 'flex-end',
    paddingHorizontal: SPACE.screenX, gap: SPACE.sm,
  },
  // Grille 2×2 : deux rangées qui se partagent la hauteur (plafond gridRowMax)
  optionsRow: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', flexDirection: 'row', gap: SPACE.sm },
  // Liste 1×4 : quatre lignes pleine largeur de même hauteur (listRowMin → listRowMax)
  listRow: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto' },

  // Toast de série : corail plein, texte nuit
  streakToastWrapper: {
    position: 'absolute', top: '38%', left: 0, right: 0,
    alignItems: 'center',
  },
  streakToast: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md,
    borderRadius: RADII.pill,
    backgroundColor: COLOR.accent.warm,
    ...ELEVATION.e2,
  },
});
