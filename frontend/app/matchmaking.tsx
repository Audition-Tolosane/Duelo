import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, Dimensions, BackHandler, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, withSpring, withDelay, Easing, useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import SwipeBackPage from '../components/SwipeBackPage';
import {
  ScreenContainer, AppHeader, Txt, Icon, Button, Card, PlayerCard, Dialog,
} from '../components/ui';
import type { IconName } from '../components/ui';
import { useWS } from '../contexts/WebSocketContext';
import { dueloWS } from '../services/websocket';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';
import { COLOR, SPACE, RADII, SIZE, BORDER, GRADIENTS, GLOW, ELEVATION, PALETTE, alpha } from '../theme/tokens';

// Real world map paths from Natural Earth data (Mercator projection, 1000×500 viewBox)
import MAP_PATHS from '../assets/map-paths.json';

const { width: SW, height: SH } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
// Petits écrans (320×568…) : espacements resserrés pour que le VS tienne sans défilement
const COMPACT_VS = SH < 700;

// ── Écran VS : chorégraphie (ms) ──
const VS_IMPACT_DELAY = 260; // les cartes arrivent, puis le « vs » claque au centre
const VS_POP_DUR      = 280; // « vs » 1.4 → 1
const VS_FLASH_IN     = 70;  // éclair : montée…
const VS_FLASH_OUT    = 300; // …et extinction (total < 400 ms, une seule fois)
const VS_LINE_DUR     = 240; // demi-traits qui jaillissent du centre
const VS_WAVE_DUR     = 520; // onde de choc unique
const VS_DEPTH_DUR    = 3000; // dérive lente de la carte pendant le VS
const VS_FLASH_SIZE   = 96;
const VS_WAVE_SIZE    = 64;


// Badge de série de l'adversaire → icône Lucide du registre
const BADGE_ICON_MAP: Record<string, IconName> = { fire: 'flame', bolt: 'bolt', glow: 'sparkles' };


// Villes réelles (lat/lon) pour les dots joueurs
const CITY_PINS = [
  { lat: 40,  lon: -99,  name: 'Alex'  }, // USA
  { lat: -12, lon: -52,  name: 'Mia'   }, // Brésil
  { lat: 46,  lon: 2,    name: 'Lucas' }, // France
  { lat: 10,  lon: 9,    name: 'Emma'  }, // Nigeria
  { lat: 56,  lon: 37,   name: 'Noah'  }, // Russie
  { lat: 22,  lon: 78,   name: 'Léa'   }, // Inde
  { lat: 36,  lon: 104,  name: 'Hugo'  }, // Chine
  { lat: 36,  lon: 138,  name: 'Chloé' }, // Japon
  { lat: -24, lon: 134,  name: 'Tom'   }, // Australie
  { lat: 62,  lon: 17,   name: 'Jade'  }, // Suède
  { lat: 23,  lon: -103, name: 'Liam'  }, // Mexique
  { lat: 24,  lon: 45,   name: 'Sarah' }, // Arabie Saoudite
  { lat: 16,  lon: 101,  name: 'Enzo'  }, // Thaïlande
  { lat: -1,  lon: 114,  name: 'Luna'  }, // Indonésie
  { lat: 56,  lon: -97,  name: 'Adam'  }, // Canada
  { lat: -3,  lon: 24,   name: 'Zoé'   }, // RD Congo
  { lat: 51,  lon: 10,   name: 'Max'   }, // Allemagne
  { lat: -34, lon: -64,  name: 'Sofia' }, // Argentine
  { lat: -29, lon: 25,   name: 'Ryo'   }, // Afrique du Sud
  { lat: 26,  lon: 30,   name: 'Omar'  }, // Égypte
  { lat: 39,  lon: 35,   name: 'Maya'  }, // Turquie
  { lat: 48,  lon: 68,   name: 'Diego' }, // Kazakhstan
];


// Centres des pays pour le départ (code ISO → lat/lon)
const COUNTRY_START: Record<string, { lat: number; lon: number }> = {
  FR: { lat: 46,  lon: 2   }, BE: { lat: 50,  lon: 4   }, CH: { lat: 47,  lon: 8   },
  LU: { lat: 50,  lon: 6   }, MC: { lat: 44,  lon: 7   }, IT: { lat: 42,  lon: 12  },
  ES: { lat: 40,  lon: -4  }, PT: { lat: 39,  lon: -8  }, DE: { lat: 51,  lon: 10  },
  GB: { lat: 52,  lon: -1  }, IE: { lat: 53,  lon: -8  }, NL: { lat: 52,  lon: 5   },
  SE: { lat: 62,  lon: 17  }, NO: { lat: 62,  lon: 10  }, DK: { lat: 56,  lon: 10  },
  FI: { lat: 62,  lon: 26  }, PL: { lat: 52,  lon: 20  }, RO: { lat: 46,  lon: 25  },
  US: { lat: 38,  lon: -97 }, CA: { lat: 56,  lon: -97 }, MX: { lat: 23,  lon: -103},
  BR: { lat: -12, lon: -52 }, AR: { lat: -34, lon: -64 }, CO: { lat: 4,   lon: -74 },
  RU: { lat: 56,  lon: 37  }, UA: { lat: 49,  lon: 32  }, TR: { lat: 39,  lon: 35  },
  MA: { lat: 32,  lon: -6  }, DZ: { lat: 28,  lon: 3   }, TN: { lat: 34,  lon: 9   },
  EG: { lat: 26,  lon: 30  }, SN: { lat: 14,  lon: -14 }, CI: { lat: 7,   lon: -6  },
  NG: { lat: 10,  lon: 9   }, CM: { lat: 5,   lon: 12  }, CD: { lat: -3,  lon: 24  },
  ZA: { lat: -29, lon: 25  }, KE: { lat: -1,  lon: 38  }, ET: { lat: 9,   lon: 40  },
  IN: { lat: 22,  lon: 78  }, CN: { lat: 36,  lon: 104 }, JP: { lat: 36,  lon: 138 },
  KR: { lat: 36,  lon: 128 }, SA: { lat: 24,  lon: 45  }, AE: { lat: 24,  lon: 54  },
  TH: { lat: 16,  lon: 101 }, ID: { lat: -1,  lon: 114 }, AU: { lat: -24, lon: 134 },
  NZ: { lat: -42, lon: 173 }, PK: { lat: 30,  lon: 70  }, BD: { lat: 23,  lon: 90  },
};

// Noms de pays en français (utilisés par les bots) → lat/lon
const COUNTRY_NAME_FR: Record<string, { lat: number; lon: number }> = {
  'france':           COUNTRY_START.FR, 'belgique':         COUNTRY_START.BE,
  'suisse':           COUNTRY_START.CH, 'luxembourg':       COUNTRY_START.LU,
  'italie':           COUNTRY_START.IT, 'espagne':          COUNTRY_START.ES,
  'portugal':         COUNTRY_START.PT, 'allemagne':        COUNTRY_START.DE,
  'royaume-uni':      COUNTRY_START.GB, 'angleterre':       COUNTRY_START.GB,
  'irlande':          COUNTRY_START.IE, 'pays-bas':         COUNTRY_START.NL,
  'suède':            COUNTRY_START.SE, 'norvège':          COUNTRY_START.NO,
  'danemark':         COUNTRY_START.DK, 'finlande':         COUNTRY_START.FI,
  'pologne':          COUNTRY_START.PL, 'roumanie':         COUNTRY_START.RO,
  'états-unis':       COUNTRY_START.US, 'etats-unis':       COUNTRY_START.US,
  'canada':           COUNTRY_START.CA, 'mexique':          COUNTRY_START.MX,
  'brésil':           COUNTRY_START.BR, 'bresil':           COUNTRY_START.BR,
  'argentine':        COUNTRY_START.AR, 'colombie':         COUNTRY_START.CO,
  'pérou':            COUNTRY_START.PE || { lat: -10, lon: -76 },
  'russie':           COUNTRY_START.RU, 'ukraine':          COUNTRY_START.UA,
  'turquie':          COUNTRY_START.TR, 'maroc':            COUNTRY_START.MA,
  'algérie':          COUNTRY_START.DZ, 'algerie':          COUNTRY_START.DZ,
  'tunisie':          COUNTRY_START.TN, 'égypte':           COUNTRY_START.EG,
  'egypte':           COUNTRY_START.EG, 'sénégal':          COUNTRY_START.SN,
  'senegal':          COUNTRY_START.SN, "côte d'ivoire":    COUNTRY_START.CI,
  'nigeria':          COUNTRY_START.NG, 'cameroun':         COUNTRY_START.CM,
  'congo':            COUNTRY_START.CD, 'afrique du sud':   COUNTRY_START.ZA,
  'kenya':            COUNTRY_START.KE, 'éthiopie':         COUNTRY_START.ET,
  'inde':             COUNTRY_START.IN, 'chine':            COUNTRY_START.CN,
  'japon':            COUNTRY_START.JP, 'corée du sud':     COUNTRY_START.KR,
  'arabie saoudite':  COUNTRY_START.SA, 'émirats arabes unis': COUNTRY_START.AE,
  'thaïlande':        COUNTRY_START.TH,
  'indonésie':        COUNTRY_START.ID, 'australie':        COUNTRY_START.AU,
  'nouvelle-zélande': COUNTRY_START.NZ, 'pakistan':         COUNTRY_START.PK,
  'bangladesh':       COUNTRY_START.BD,
};

function lookupCountry(country: string): { lat: number; lon: number } | undefined {
  if (!country) return undefined;
  // Try ISO code first (2-3 letters, e.g. "US", "FR")
  const iso = COUNTRY_START[country.toUpperCase()];
  if (iso) return iso;
  // Try French name
  return COUNTRY_NAME_FR[country.toLowerCase()];
}

// Map sizing — déclaré avant les fonctions qui en dépendent
const SVG_W = 1000;
const SVG_H = 500;
const SCALE = Math.max(SW / SVG_W, SH / SVG_H) * 1.9;
const REAL_W = SVG_W * SCALE;
const REAL_H = SVG_H * SCALE;

// Equirectangulaire : lon/lat → coordonnées SVG 1000×500
function latLonToSvg(lat: number, lon: number) {
  return {
    x: (lon + 180) / 360 * SVG_W,
    y: (90 - lat)  / 180 * SVG_H,
  };
}

// Coordonnées SVG → offset de translation pour centrer ce point à l'écran (scale additionnel s)
function svgToOffset(svgX: number, svgY: number, s: number = 1) {
  return {
    x: (SW - REAL_W) / (2 * s) + REAL_W / 2 - svgX * SCALE,
    y: (SH - REAL_H) / (2 * s) + REAL_H / 2 - svgY * SCALE,
  };
}

// Par défaut : centré sur Europe occidentale
const DEFAULT_START = svgToOffset(...Object.values(latLonToSvg(48, 10)) as [number, number]);


type OpponentData = {
  id: string;
  pseudo: string;
  avatar_seed: string;
  is_bot: boolean;
  level: number;
  title: string;
  streak: number;
  streak_badge: string;
  country?: string;
  // Profil de jeu du bot (renvoyé par /matchmaking-v2, transmis tel quel à /game)
  skill_level?: number;
  avg_speed?: number;
};

type PlayerData = { level: number; title: string };

// ── Épingles de la carte ──
// Joueurs en ligne : simples points crème à 60 % qui respirent (aucune couleur d'identité).
// Rival : disque corail avec son initiale et une onde qui pulse (événement).
const PIN_DOT = 10;
const PIN_TARGET = 32;

function PlayerPin({ x, y }: { x: number; y: number }) {
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 + Math.random() * 800 }),
        withTiming(0.5, { duration: 1200 + Math.random() * 800 }),
      ),
      -1, true,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        styles.pinDot,
        { left: x * SCALE - PIN_DOT / 2, top: y * SCALE - PIN_DOT / 2 },
        pulseStyle,
      ]}
    />
  );
}

function OpponentPin({ x, y, name }: { x: number; y: number; name: string }) {
  const wave = useSharedValue(0);

  useEffect(() => {
    wave.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
  }, []);

  const waveStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - wave.value),
    transform: [{ scale: 1 + wave.value * 1.4 }],
  }));

  return (
    <View style={[styles.pinTargetWrap, { left: x * SCALE - PIN_TARGET / 2, top: y * SCALE - PIN_TARGET / 2 }]}>
      <Animated.View style={[styles.pinWave, waveStyle]} />
      <View style={styles.pinTarget}>
        <Txt variant="label" color={COLOR.text.onAction}>{name[0]?.toUpperCase()}</Txt>
      </View>
    </View>
  );
}

// ── Main Screen ──
export default function MatchmakingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { category: rawCategory, themeName, rematch, room_id: challengeRoomId, challenge, opponentPseudo: challengeOpponentPseudo, botPseudo: rematchBotPseudo, botSeed: rematchBotSeed } = useLocalSearchParams<{ category: string; themeName: string; rematch: string; room_id: string; challenge: string; opponentPseudo: string; botPseudo: string; botSeed: string }>();
  const category = rawCategory || '';
  const isRematch = rematch === 'true';
  const isChallengeMode = challenge === 'true' && !!challengeRoomId;
  const { send: wsSend, on: wsOn } = useWS();
  const [dots, setDots] = useState('');
  const [message, setMessage] = useState(t('matchmaking.searching_opponent'));
  const [phase, setPhase] = useState<'searching' | 'found' | 'versus'>('searching');
  const [opponent, setOpponent] = useState<OpponentData | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerData | null>(null);
  const [pseudo, setPseudo] = useState(t('matchmaking.player'));
  const [roomId, setRoomId] = useState<string | null>(null);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  // Décompte purement visuel pendant la phase versus (la navigation reste pilotée par navDelay)
  const [vsCountdown, setVsCountdown] = useState(3);

  const mapX = useSharedValue(DEFAULT_START.x);
  const mapY = useSharedValue(DEFAULT_START.y);
  const mapScaleAnim = useSharedValue(1);
  const overlayOpacity = useSharedValue(0);

  const vsOpacity = useSharedValue(0);
  const vsScale = useSharedValue(0.5);
  const playerSlideX = useSharedValue(-SW);
  const opponentSlideX = useSharedValue(SW);
  // Collision au centre : demi-traits, éclair, onde (une seule fois)
  const vsLineScale = useSharedValue(0);
  const vsFlash = useSharedValue(0);
  const vsWave = useSharedValue(0);
  const cardHalo = useSharedValue(0);
  // Pop du décompte
  const countPop = useSharedValue(1);
  const countFade = useSharedValue(1);
  // Profondeur lente du fond pendant le VS
  const depth = useSharedValue(0);

  // « Réduire les animations » : pas de glissade, ni éclair, ni onde, ni dérive
  const reduceMotion = useReducedMotion();
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  const [targetPin, setTargetPin] = useState<{ x: number; y: number } | null>(null);

  // Pins régénérés à chaque mount (shuffle + lat/lon réels)
  const playerPinsRef = useRef<Array<{ x: number; y: number; name: string }> | null>(null);
  if (!playerPinsRef.current) {
    const shuffledCities = [...CITY_PINS].sort(() => Math.random() - 0.5);
    playerPinsRef.current = shuffledCities.map((city) => {
      const svg = latLonToSvg(city.lat, city.lon);
      return {
        x: svg.x,
        y: svg.y,
        name: city.name,
      };
    });
  }
  const playerPins = playerPinsRef.current;

  const SEARCH_MESSAGES = [
    t('matchmaking.searching_opponent'),
    t('matchmaking.scanning_players'),
    t('matchmaking.exploring_globe'),
    t('matchmaking.connecting_network'),
  ];

  // Hard fallback: if no match found after 30s regardless of WS state, launch bot
  const matchFoundRef = useRef(false);
  useEffect(() => {
    if (isRematch || isChallengeMode) return;
    const hardTimeout = setTimeout(() => {
      if (!matchFoundRef.current) {
        fetchBotOpponent();
      }
    }, 30000);
    return () => clearTimeout(hardTimeout);
  }, []);

  useEffect(() => {
    if (!category && !isChallengeMode) {
      router.replace('/(tabs)/play');
      return;
    }
    loadPlayerInfo();
    // Revanche contre un joueur réel : salle privée (isChallengeMode + room_id).
    // Revanche contre un bot (rematch=true sans salle) : même bot, même pseudo.
    if (isRematch && !isChallengeMode) {
      fetchBotOpponent();
    } else if (isChallengeMode) {
      // Challenge mode: join the private room instead of the matchmaking queue
      wsSend({ action: 'challenge_join', room_id: challengeRoomId });
    } else {
      wsSend({ action: 'matchmaking_join', theme_id: category });
    }
    return () => {
      if (!isRematch && !isChallengeMode) {
        wsSend({ action: 'matchmaking_leave' });
        dueloWS.clearQueue();
      }
    };
  }, []);

  useEffect(() => {
    const unsubs = [
      wsOn('match_found', (msg) => {
        matchFoundRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const opp = msg.data?.opponent;
        const rid = msg.data?.room_id;
        setRoomId(rid);
        const oppData: OpponentData = {
          id: opp.id || '',
          pseudo: opp.pseudo,
          avatar_seed: opp.avatar_seed,
          is_bot: false,
          level: opp.level || 1,
          title: opp.selected_title || '',
          streak: opp.streak || 0,
          streak_badge: opp.streak_badge || '',
          country: opp.country || '',
        };
        setOpponent(oppData);
        setPlayerInfo({ level: 1, title: '' });
        handleMatchFound(oppData, rid);
      }),
      wsOn('matchmaking_timeout', () => {
        matchFoundRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchBotOpponent();
      }),
      wsOn('challenge_timeout', () => {
        // Challenger didn't join in time — show choice modal
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setShowTimeoutModal(true);
      }),
      wsOn('challenge_room_expired', () => {
        // Room no longer exists — fall back to regular matchmaking
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (category) {
          wsSend({ action: 'matchmaking_join', theme_id: category });
        } else {
          router.back();
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const DEZOOM_INITIAL = 3;   // zoom de départ
  const DEZOOM_PAUSE   = 500; // pause avant dezoom (ms)
  const DEZOOM_DUR     = 2000; // durée du dezoom (ms)

  const loadPlayerInfo = async () => {
    const p = await AsyncStorage.getItem('duelo_pseudo');
    if (p) setPseudo(p);
    // Démarrer zoomé sur le pays du joueur
    const country = await AsyncStorage.getItem('duelo_country');
    const center = (country && lookupCountry(country)) || COUNTRY_START['FR'];
    const svg = latLonToSvg(center.lat, center.lon);

    const zoomedOff = svgToOffset(svg.x, svg.y, DEZOOM_INITIAL);
    mapScaleAnim.value = DEZOOM_INITIAL;
    mapX.value = zoomedOff.x;
    mapY.value = zoomedOff.y;

    // Dezoom progressif vers scale 1
    const normalOff = svgToOffset(svg.x, svg.y, 1);
    setTimeout(() => {
      mapScaleAnim.value = withTiming(1, { duration: DEZOOM_DUR, easing: Easing.inOut(Easing.ease) });
      mapX.value = withTiming(normalOff.x, { duration: DEZOOM_DUR, easing: Easing.inOut(Easing.ease) });
      mapY.value = withTiming(normalOff.y, { duration: DEZOOM_DUR, easing: Easing.inOut(Easing.ease) });
    }, DEZOOM_PAUSE);
  };

  useEffect(() => {
    if (phase !== 'searching') return;

    // Pan qui visite les vrais dots adverses (6 au hasard, shufflés) — démarre après le dezoom
    const targets = [...playerPins]
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .map(pin => svgToOffset(pin.x, pin.y, 1));
    let i = 0;
    const next = () => {
      const t = targets[i % targets.length];
      mapX.value = withTiming(t.x, { duration: 5000, easing: Easing.inOut(Easing.ease) });
      mapY.value = withTiming(t.y, { duration: 5000, easing: Easing.inOut(Easing.ease) });
      i++;
    };

    let panInterval: ReturnType<typeof setInterval>;
    const panDelay = DEZOOM_PAUSE + DEZOOM_DUR + 300; // attend la fin du dezoom
    const panStart = setTimeout(() => {
      next();
      panInterval = setInterval(next, 5500);
    }, panDelay);

    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % SEARCH_MESSAGES.length;
      setMessage(SEARCH_MESSAGES[msgIdx]);
    }, 3000);

    return () => {
      clearTimeout(panStart);
      clearInterval(panInterval);
      clearInterval(dotsInterval);
      clearInterval(msgInterval);
    };
  }, [phase]);

  // Bot de secours (API injoignable) — doit être INDISCERNABLE d'un humain :
  // jamais de pseudo « Bot » ni de seed révélatrice.
  const FALLBACK_PSEUDOS = ['Nova_78', 'Lucas.M', 'SarahQz', 'Tom_Lyon', 'Mimi31', 'AlexKz', 'Leo_Mtp', 'JuJu_92'];
  const FALLBACK_BOT: OpponentData = {
    id: '',
    pseudo: FALLBACK_PSEUDOS[Math.floor(Math.random() * FALLBACK_PSEUDOS.length)],
    avatar_seed: `p${Math.floor(Math.random() * 9000) + 1000}`,
    is_bot: true,
    level: 2 + Math.floor(Math.random() * 9),
    title: '', streak: Math.random() < 0.3 ? 1 + Math.floor(Math.random() * 3) : 0,
    streak_badge: '', country: 'FR',
  };

  const fetchBotOpponent = async () => {
    matchFoundRef.current = true;
    try {
      const userId = await AsyncStorage.getItem('duelo_user_id');
      const res = await authFetch(`${API_URL}/api/game/matchmaking-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_id: category, player_id: userId }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          // Token expiré — forcer reconnexion
          await AsyncStorage.multiRemove(['duelo_token', 'duelo_user_id']);
          router.replace('/login' as any);
          return;
        }
        const errText = await res.text().catch(() => '');
        console.warn(`[fetchBotOpponent] API error ${res.status}: ${errText} | category="${category}"`);
        setOpponent(FALLBACK_BOT);
        handleMatchFound(FALLBACK_BOT);
        return;
      }
      const data = await res.json();
      console.log('[fetchBotOpponent] opponent:', data.opponent?.pseudo, '| category:', category);
      let opp: OpponentData = data.opponent ?? FALLBACK_BOT;
      // Revanche contre un bot : on garde l'identité de l'adversaire du match précédent,
      // sinon « Revanche » ferait affronter quelqu'un d'autre.
      if (isRematch && rematchBotPseudo) {
        opp = { ...opp, pseudo: decodeURIComponent(rematchBotPseudo), avatar_seed: rematchBotSeed || opp.avatar_seed };
      }
      setOpponent(opp);
      setPlayerInfo(data.player ?? { level: 1, title: '' });
      handleMatchFound(opp);
    } catch (e) {
      console.warn('[fetchBotOpponent] catch:', e);
      setOpponent(FALLBACK_BOT);
      handleMatchFound(FALLBACK_BOT);
    }
  };

  // Chorégraphie d'entrée du VS (présentation seulement, aucune incidence sur la navigation)
  const playVersusEntrance = () => {
    if (reduceMotionRef.current) {
      playerSlideX.value = 0;
      opponentSlideX.value = 0;
      vsScale.value = 1;
      vsLineScale.value = 1;
      cardHalo.value = 1;
      vsOpacity.value = withTiming(1, { duration: 250 });
      return;
    }
    // Cartes : entrée opposée avec un ressort court (léger dépassement puis retour)
    playerSlideX.value = withSpring(0, { damping: 11, stiffness: 150, mass: 0.8 });
    opponentSlideX.value = withSpring(0, { damping: 11, stiffness: 150, mass: 0.8 });
    cardHalo.value = withDelay(VS_IMPACT_DELAY, withTiming(1, { duration: 300 }));

    // « vs » : impulsion 1.4 → 1 au moment de l'impact
    vsScale.value = 1.4;
    vsScale.value = withDelay(VS_IMPACT_DELAY, withTiming(1, { duration: VS_POP_DUR, easing: Easing.out(Easing.cubic) }));
    vsOpacity.value = withDelay(VS_IMPACT_DELAY, withTiming(1, { duration: 160 }));

    // Éclair unique (< 400 ms)
    vsFlash.value = withDelay(VS_IMPACT_DELAY, withSequence(
      withTiming(1, { duration: VS_FLASH_IN }),
      withTiming(0, { duration: VS_FLASH_OUT, easing: Easing.out(Easing.quad) }),
    ));
    // Demi-traits qui jaillissent du centre
    vsLineScale.value = withDelay(VS_IMPACT_DELAY, withTiming(1, { duration: VS_LINE_DUR, easing: Easing.out(Easing.cubic) }));
    // Onde de choc : une seule, depuis le point d'impact
    vsWave.value = 0;
    vsWave.value = withDelay(VS_IMPACT_DELAY, withTiming(1, { duration: VS_WAVE_DUR, easing: Easing.out(Easing.quad) }));

    // Fond : zoom / dérive très lents (quelques %), pendant le VS uniquement
    depth.value = withTiming(1, { duration: VS_DEPTH_DUR, easing: Easing.out(Easing.quad) });
  };

  const handleMatchFound = (opp: OpponentData, matchRoomId?: string) => {
    const oppCenter = lookupCountry(opp.country || '')
      || CITY_PINS[Math.floor(Math.random() * CITY_PINS.length)];
    const pin = latLonToSvg(oppCenter.lat, oppCenter.lon);
    setTargetPin(pin);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const isBotMatch = !matchRoomId;
    // Rematch: skip map pan, go straight to VS
    const panDuration = isRematch ? 400 : 2200;
    const vsDelay = isRematch ? 500 : 2500;
    const navDelay = isRematch ? 2800 : 5200;

    setPhase('found');

    // Pan vers le pays de l'adversaire à scale=1 (formule garantie correcte)
    const targetOff = svgToOffset(pin.x, pin.y, 1);
    mapScaleAnim.value = withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) });
    mapX.value = withTiming(targetOff.x, { duration: panDuration, easing: Easing.inOut(Easing.cubic) });
    mapY.value = withTiming(targetOff.y, { duration: panDuration, easing: Easing.inOut(Easing.cubic) });

    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setPhase('versus');
      overlayOpacity.value = withTiming(1, { duration: 400 });
      playVersusEntrance();
      // Décompte visuel 3 → 2 → 1 calé sur la fenêtre versus (~2,7s)
      setVsCountdown(3);
      setTimeout(() => setVsCountdown(2), 900);
      setTimeout(() => setVsCountdown(1), 1800);
    }, vsDelay);

    setTimeout(() => {
      const skillParam = opp.skill_level != null ? `&botSkill=${opp.skill_level}` : '';
      const speedParam = opp.avg_speed   != null ? `&botSpeed=${opp.avg_speed}`   : '';
      router.replace(
        `/game?category=${category}&opponentPseudo=${opp.pseudo}&opponentSeed=${opp.avatar_seed}&isBot=${isBotMatch}&opponentLevel=${opp.level}&opponentStreak=${opp.streak}&opponentId=${opp.id || ''}${matchRoomId ? `&roomId=${matchRoomId}` : ''}${skillParam}${speedParam}`
      );
    }, navDelay);
  };

  const mapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: mapX.value },
      { translateY: mapY.value },
      { scale: mapScaleAnim.value },
    ],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const vsAnimStyle = useAnimatedStyle(() => ({
    opacity: vsOpacity.value,
    transform: [{ scale: vsScale.value }],
  }));

  const vsLineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: vsLineScale.value }],
  }));

  const vsFlashStyle = useAnimatedStyle(() => ({
    opacity: vsFlash.value,
    transform: [{ scale: 0.7 + vsFlash.value * 0.4 }],
  }));

  const vsWaveStyle = useAnimatedStyle(() => ({
    opacity: vsWave.value > 0 ? 0.6 * (1 - vsWave.value) : 0,
    transform: [{ scale: 0.4 + vsWave.value * 2.2 }],
  }));

  const cardHaloStyle = useAnimatedStyle(() => ({ opacity: cardHalo.value }));

  const countPopStyle = useAnimatedStyle(() => ({
    opacity: countFade.value,
    transform: [{ scale: countPop.value }],
  }));

  const depthStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -SW * 0.015 * depth.value },
      { translateY: -SH * 0.01 * depth.value },
      { scale: 1 + 0.05 * depth.value },
    ],
  }));

  // Chaque chiffre du décompte fait un « pop » (1.25 → 1)
  useEffect(() => {
    if (phase !== 'versus' || reduceMotionRef.current) return;
    countPop.value = 1.25;
    countFade.value = 0.3;
    countPop.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    countFade.value = withTiming(1, { duration: 200 });
  }, [vsCountdown, phase]);

  const playerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playerSlideX.value }],
  }));

  const opponentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: opponentSlideX.value }],
  }));

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isRematch && !isChallengeMode) wsSend({ action: 'matchmaking_leave' });
    router.back();
  };

  // Retour Android : annule proprement pendant la recherche ; bloqué une fois l'adversaire trouvé
  // (la partie est déjà créée côté serveur, partir laisserait l'autre joueur seul).
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    if (Platform.OS === 'web') return; // pas de bouton retour matériel sur le web
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phaseRef.current === 'searching') handleCancel();
      return true;
    });
    return () => sub.remove();
  }, []);

  const getCategoryLabel = () => {
    const name = themeName ? decodeURIComponent(themeName) : category;
    return name || 'Quiz';
  };

  const oppBadgeIcon: IconName = (opponent && BADGE_ICON_MAP[opponent.streak_badge]) || 'flame';

  const challengeName = challengeOpponentPseudo ? decodeURIComponent(challengeOpponentPseudo) : '...';
  // Défi : accent corail (événement) ; recherche publique : jaune (mon action en cours)
  const searchAccent = isChallengeMode ? COLOR.accent.warm : COLOR.action.primary;
  const overlayBottom = { bottom: insets.bottom + SPACE.huge };

  return (
    <SwipeBackPage enabled={phase === 'searching'} onBack={handleCancel}>
      <ScreenContainer>
        {/* ── Carte du monde : une seule couche pétrole ── */}
        <View style={styles.mapViewport} pointerEvents="none">
          {/* Couche de profondeur : immobile sauf pendant le VS (dérive lente de quelques %) */}
          <Animated.View style={[StyleSheet.absoluteFill, depthStyle]}>
            <Animated.View style={[styles.mapContainer, mapStyle]}>
              <Svg
                width={REAL_W}
                height={REAL_H}
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                style={styles.mapSvg}
              >
                {(MAP_PATHS as string[]).map((d, i) => (
                  <Path key={`f-${i}`} d={d}
                    fill={COLOR.surface.card}
                    stroke={COLOR.surface.elevated}
                    strokeWidth={0.6}
                    strokeLinejoin="round" />
                ))}
              </Svg>
  
              {/* Joueurs en ligne et rival localisé : masqués pendant le VS, sinon l'épingle du
                  rival réapparaît en « cercle fantôme » sous la ligne vs (V1.2). */}
              {phase !== 'versus' && playerPins.map((pin, i) => (
                <PlayerPin key={`pin-${i}`} x={pin.x} y={pin.y} />
              ))}
              {phase !== 'versus' && targetPin && opponent && (
                <OpponentPin x={targetPin.x} y={targetPin.y} name={opponent.pseudo} />
              )}
            </Animated.View>
          </Animated.View>

          {/* Fondus haut / bas : la carte se fond dans la nuit pétrole */}
          <LinearGradient colors={GRADIENTS.fadeTop.colors} style={styles.fadeTop} />
          <LinearGradient colors={GRADIENTS.fadeBottom.colors} style={styles.fadeBottom} />
        </View>

        {phase !== 'versus' && <AppHeader />}

        {/* ── Recherche ── */}
        {phase === 'searching' && (
          <View style={[styles.bottomOverlay, overlayBottom]}>
            <Card style={styles.searchCard}>
              <View style={styles.themePill}>
                <Icon name="duel" size={16} color={searchAccent} />
                <Txt variant="label" color={COLOR.text.primary} numberOfLines={1} style={styles.shrink}>
                  {getCategoryLabel()}
                </Txt>
              </View>
              <View style={styles.scannerRow}>
                <View style={[styles.scannerDot, { backgroundColor: searchAccent }]} />
                <Txt variant="body" numberOfLines={2} style={styles.shrink}>
                  {isChallengeMode
                    ? `${t('challenge.waiting_for')} ${challengeName}${dots}`
                    : `${message}${dots}`}
                </Txt>
              </View>
              <View style={styles.hintRow}>
                <Icon name={isChallengeMode ? 'shield' : 'globe'} size={16} color={COLOR.text.tertiary} />
                <Txt variant="caption" numberOfLines={1} style={styles.shrink}>
                  {isChallengeMode ? t('challenge.ready_title') : t('matchmaking.scanning_active')}
                </Txt>
              </View>
            </Card>
            <Button
              label={t('common.cancel')}
              variant="ghost"
              icon="close"
              fullWidth
              haptic={false}
              onPress={handleCancel}
            />
          </View>
        )}

        {/* ── Adversaire localisé (événement → corail) ── */}
        {phase === 'found' && opponent && (
          <View style={[styles.bottomOverlay, overlayBottom]}>
            <Card accent="event" style={styles.foundCard}>
              <Icon name="target" size={28} color={COLOR.accent.warm} />
              <Txt variant="h3" color={COLOR.player.opponentText} align="center">{t('matchmaking.opponent_located')}</Txt>
              <Txt variant="h2" align="center" numberOfLines={1}>{opponent.pseudo}</Txt>
            </Card>
          </View>
        )}

        {/* ── VS ── */}
        {phase === 'versus' && opponent && (
          <>
            <Animated.View style={[styles.versusBackdrop, overlayStyle]} />
            {/* Halos : jaune en haut (moi), corail en bas (rival) */}
            <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]} pointerEvents="none">
              <LinearGradient colors={GRADIENTS.vsSelf.colors} style={styles.haloTop} />
              <LinearGradient
                colors={GRADIENTS.vsOpponent.colors}
                start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }}
                style={styles.haloBottom}
              />
            </Animated.View>
            <View style={[styles.versusOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
              <View style={styles.versusContent}>
                <View style={styles.versusHeader}>
                  <Txt variant="overline" color={COLOR.player.opponentText} align="center" numberOfLines={1}>{t('matchmaking.opponent_located')}</Txt>
                  <Txt variant="h2" align="center" numberOfLines={COMPACT_VS ? 1 : 2}>{getCategoryLabel()}</Txt>
                </View>

                {/* Moi : jaune, entre depuis la gauche avec un ressort court */}
                <Animated.View style={[styles.selfSlot, playerStyle]}>
                  <View>
                    <Animated.View pointerEvents="none" style={[styles.cardHalo, styles.cardHaloSelf, cardHaloStyle]} />
                    <PlayerCard
                      side="self"
                      spotlight
                      pseudo={pseudo}
                      title={playerInfo?.title || undefined}
                      subtitle={`${t('matchmaking.level_short')} ${playerInfo?.level || 1}`}
                    />
                  </View>
                </Animated.View>

                {/* Collision : demi-traits jaune (moi) / corail (rival) qui jaillissent du centre, « vs » au point d'impact */}
                <View style={styles.vsRow}>
                  <View style={styles.vsImpact} pointerEvents="none">
                    <Animated.View style={[styles.vsFlash, vsFlashStyle]} />
                    <Animated.View style={[styles.vsWave, vsWaveStyle]} />
                  </View>
                  <Animated.View style={[styles.vsLine, styles.vsLineSelf, vsLineStyle]} />
                  <Animated.View style={vsAnimStyle}>
                    <Txt variant="moment">{t('players.vs')}</Txt>
                  </Animated.View>
                  <Animated.View style={[styles.vsLine, styles.vsLineOpponent, vsLineStyle]} />
                </View>

                {/* Rival : corail, entre depuis la droite avec un ressort court */}
                <Animated.View style={[styles.opponentSlot, opponentStyle]}>
                  <View>
                    <Animated.View pointerEvents="none" style={[styles.cardHalo, styles.cardHaloOpponent, cardHaloStyle]} />
                    <PlayerCard
                      side="opponent"
                      spotlight
                      pseudo={opponent.pseudo}
                      avatarSeed={opponent.avatar_seed}
                      title={opponent.title || undefined}
                      subtitle={`${t('matchmaking.level_short')} ${opponent.level}`}
                    />
                  </View>
                  {opponent.streak >= 3 && (
                    <View style={styles.streakTag}>
                      <Icon name={oppBadgeIcon} size={16} color={COLOR.accent.warm} />
                      <Txt variant="label" color={COLOR.player.opponentText}>
                        {opponent.streak} {t('matchmaking.wins')}
                      </Txt>
                    </View>
                  )}
                </Animated.View>

                {/* Décompte : crème, puis jaune sur le dernier temps ; chaque chiffre fait un « pop » */}
                <Animated.View style={[styles.countdownWrap, overlayStyle]}>
                  <Animated.View style={countPopStyle}>
                    <Txt variant="countdown" color={vsCountdown === 1 ? COLOR.action.primary : COLOR.text.primary}>
                      {vsCountdown}
                    </Txt>
                  </Animated.View>
                  <Txt variant="overline" align="center" numberOfLines={1}>{t('matchmaking.duel_starting')}</Txt>
                </Animated.View>
              </View>
            </View>
          </>
        )}
      </ScreenContainer>

      {/* ── Défi : l'adversaire n'a pas rejoint ── */}
      <Dialog
        visible={showTimeoutModal}
        dismissable={false}
        onClose={() => { if (phaseRef.current === 'searching') handleCancel(); }}
        icon="clock"
        tone="event"
        title={t('challenge.timeout_title')}
        message={t('challenge.timeout_body')}
        actions={(
          <>
            <Button
              label={t('challenge.play_now')}
              icon="bolt"
              fullWidth
              haptic={false}
              onPress={() => { setShowTimeoutModal(false); fetchBotOpponent(); }}
            />
            <Button
              label={t('common.cancel')}
              variant="ghost"
              fullWidth
              haptic={false}
              onPress={() => { setShowTimeoutModal(false); router.replace('/(tabs)/accueil'); }}
            />
          </>
        )}
      />
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  // Carte du monde
  mapViewport: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  mapContainer: { width: REAL_W, height: REAL_H, position: 'absolute' },
  mapSvg: { position: 'absolute', top: 0, left: 0 },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 160 },
  fadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 320 },

  // Épingles
  pinDot: {
    position: 'absolute',
    width: PIN_DOT, height: PIN_DOT, borderRadius: RADII.pill,
    backgroundColor: COLOR.text.tertiary,
    zIndex: 10,
  },
  pinTargetWrap: {
    position: 'absolute',
    width: PIN_TARGET, height: PIN_TARGET,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  pinWave: {
    ...StyleSheet.absoluteFill,
    borderRadius: RADII.pill,
    backgroundColor: COLOR.player.opponent,
  },
  pinTarget: {
    width: PIN_TARGET, height: PIN_TARGET, borderRadius: RADII.pill,
    backgroundColor: COLOR.player.opponent,
    borderWidth: BORDER.strong, borderColor: COLOR.text.primary,
    alignItems: 'center', justifyContent: 'center',
    ...GLOW.opponent,
  },

  // Recherche / adversaire localisé
  bottomOverlay: { position: 'absolute', left: SPACE.screenX, right: SPACE.screenX, gap: SPACE.md },
  searchCard: { alignItems: 'center', gap: SPACE.md, ...ELEVATION.e2 },
  themePill: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    height: SIZE.chip, maxWidth: '100%', paddingHorizontal: SPACE.md,
    borderRadius: RADII.pill,
    backgroundColor: COLOR.action.ghost,
    borderWidth: BORDER.hair, borderColor: COLOR.border.default,
  },
  shrink: { flexShrink: 1 },
  scannerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  scannerDot: { width: SPACE.sm, height: SPACE.sm, borderRadius: RADII.pill },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  foundCard: { alignItems: 'center', gap: SPACE.sm, ...ELEVATION.e2 },

  // VS
  versusBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: COLOR.overlay.scrim },
  haloTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '30%' },
  haloBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%' },
  versusOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  versusContent: { width: '100%', paddingHorizontal: SPACE.screenX },
  versusHeader: { alignItems: 'center', gap: SPACE.xs, marginBottom: COMPACT_VS ? SPACE.md : SPACE.xxl },
  // Cartes décalées : moi à gauche, le rival à droite (tension du face-à-face)
  selfSlot: { marginRight: SPACE.xxxl },
  opponentSlot: { marginLeft: SPACE.xxxl, gap: SPACE.sm },
  // Halo très léger derrière chaque carte (déborde de SPACE.sm, reste dans la marge d'écran)
  cardHalo: {
    position: 'absolute',
    top: -SPACE.sm, bottom: -SPACE.sm, left: -SPACE.sm, right: -SPACE.sm,
    borderRadius: RADII.xl + SPACE.sm,
  },
  cardHaloSelf: { backgroundColor: alpha(PALETTE.yellow, 0.10) },
  cardHaloOpponent: { backgroundColor: alpha(PALETTE.coral, 0.10) },
  streakTag: {
    alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs,
    borderRadius: RADII.pill, backgroundColor: COLOR.tint.opponent,
  },
  vsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginVertical: COMPACT_VS ? SPACE.sm : SPACE.lg },
  // Demi-traits pleins : chacun grandit depuis le centre (origine côté « vs »)
  vsLine: { flex: 1, height: BORDER.strong, borderRadius: RADII.xs },
  vsLineSelf: { backgroundColor: COLOR.player.self, transformOrigin: 'right' },
  vsLineOpponent: { backgroundColor: COLOR.player.opponent, transformOrigin: 'left' },
  // Point d'impact centré sur le « vs » : éclair crème + onde (une fois)
  vsImpact: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  vsFlash: {
    position: 'absolute',
    width: VS_FLASH_SIZE, height: VS_FLASH_SIZE, borderRadius: RADII.pill,
    backgroundColor: alpha(PALETTE.cream, 0.16),
    shadowColor: PALETTE.yellow, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
  },
  vsWave: {
    position: 'absolute',
    width: VS_WAVE_SIZE, height: VS_WAVE_SIZE, borderRadius: RADII.pill,
    borderWidth: BORDER.strong, borderColor: alpha(PALETTE.cream, 0.7),
  },
  countdownWrap: { alignItems: 'center', marginTop: COMPACT_VS ? SPACE.md : SPACE.xxl },
});
