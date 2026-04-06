import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, withSpring, Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import { useWS } from '../contexts/WebSocketContext';
import { authFetch } from '../utils/api';
import { t } from '../utils/i18n';

// Real world map paths from Natural Earth data (Mercator projection, 1000×500 viewBox)
import MAP_PATHS from '../assets/map-paths.json';

const { width: SW, height: SH } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const BADGE_ICON_MAP: Record<string, string> = { fire: 'fire', bolt: 'lightning-bolt', glow: 'shimmer' };

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

const PIN_COLORS = [
  '#FF6B35', '#00D4FF', '#4CAF50', '#FF3B5C', '#FFB800',
  '#00FF9D', '#E53935', '#8A2BE2', '#FF69B4', '#1565C0',
  '#FF9800', '#00BCD4', '#9C27B0', '#CDDC39', '#FF5722', '#3F51B5',
  '#7C4DFF', '#00E5FF', '#F50057', '#69F0AE', '#FFAB40', '#E040FB',
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
  'thaïlande':        COUNTRY_START.TH, 'thaïlande':        COUNTRY_START.TH,
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
};

type PlayerData = { level: number; title: string };

// ── Player Pin Component ──
function PlayerPin({ x, y, name, color, isTarget }: {
  x: number; y: number; name: string; color: string; isTarget?: boolean;
}) {
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

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const size = isTarget ? 38 : 24;
  const fontSize = isTarget ? 14 : 9;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x * SCALE - size / 2,
          top: y * SCALE - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: isTarget ? 3 : 1,
          borderColor: isTarget ? '#FFF' : 'rgba(255,255,255,0.35)',
          zIndex: isTarget ? 100 : 10,
        },
        !isTarget && pulseStyle,
        isTarget && {
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 25,
          elevation: 12,
        },
      ]}
    >
      <Text style={{ color: '#FFF', fontSize, fontWeight: '900' }}>
        {name[0]?.toUpperCase()}
      </Text>
    </Animated.View>
  );
}

// ── Main Screen ──
export default function MatchmakingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { category: rawCategory, themeName, rematch, room_id: challengeRoomId, challenge, opponentPseudo: challengeOpponentPseudo } = useLocalSearchParams<{ category: string; themeName: string; rematch: string; room_id: string; challenge: string; opponentPseudo: string }>();
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

  const mapX = useSharedValue(DEFAULT_START.x);
  const mapY = useSharedValue(DEFAULT_START.y);
  const mapScaleAnim = useSharedValue(1);
  const overlayOpacity = useSharedValue(0);

  const vsOpacity = useSharedValue(0);
  const vsScale = useSharedValue(0.5);
  const playerSlideX = useSharedValue(-SW);
  const opponentSlideX = useSharedValue(SW);

  const [targetPin, setTargetPin] = useState<{ x: number; y: number } | null>(null);

  // Pins régénérés à chaque mount (shuffle + lat/lon réels)
  const playerPinsRef = useRef<Array<{ x: number; y: number; name: string; color: string }> | null>(null);
  if (!playerPinsRef.current) {
    const shuffledCities = [...CITY_PINS].sort(() => Math.random() - 0.5);
    playerPinsRef.current = shuffledCities.map((city, i) => {
      const svg = latLonToSvg(city.lat, city.lon);
      return {
        x: svg.x,
        y: svg.y,
        name: city.name,
        color: PIN_COLORS[i % PIN_COLORS.length],
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

  useEffect(() => {
    if (!category && !isChallengeMode) {
      router.replace('/(tabs)/play');
      return;
    }
    loadPlayerInfo();
    if (isRematch) {
      fetchBotOpponent();
    } else if (isChallengeMode) {
      // Challenge mode: join the private room instead of the matchmaking queue
      wsSend({ action: 'challenge_join', room_id: challengeRoomId });
    } else {
      wsSend({ action: 'matchmaking_join', theme_id: category });
    }
    return () => {
      if (!isRematch && !isChallengeMode) wsSend({ action: 'matchmaking_leave' });
    };
  }, []);

  useEffect(() => {
    const unsubs = [
      wsOn('match_found', (msg) => {
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

  const fetchBotOpponent = async () => {
    try {
      const userId = await AsyncStorage.getItem('duelo_user_id');
      const res = await authFetch(`${API_URL}/api/game/matchmaking-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_id: category, player_id: userId }),
      });
      const data = await res.json();
      setOpponent(data.opponent);
      setPlayerInfo(data.player);
      handleMatchFound(data.opponent);
    } catch {
      router.back();
    }
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
      vsOpacity.value = withTiming(1, { duration: 500 });
      vsScale.value = withSpring(1, { damping: 12, stiffness: 100 });
      playerSlideX.value = withSpring(0, { damping: 14, stiffness: 80 });
      opponentSlideX.value = withSpring(0, { damping: 14, stiffness: 80 });
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

  const getCategoryLabel = () => {
    const name = themeName ? decodeURIComponent(themeName) : category;
    return name || 'Quiz';
  };

  const oppBadgeIcon = opponent ? (BADGE_ICON_MAP[opponent.streak_badge] || '') : '';
  const oppIsGlow = opponent?.streak_badge === 'glow';

  return (
    <SwipeBackPage>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <DueloHeader />

        {/* ── World Map Layer ── */}
        <View style={styles.mapViewport}>
          <Animated.View style={[styles.mapContainer, mapStyle]}>
            <Svg
              width={REAL_W}
              height={REAL_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              {/* Subtle grid */}
              {Array.from({ length: 9 }).map((_, i) => (
                <Path key={`h-${i}`} d={`M0,${(i+1)*50} L1000,${(i+1)*50}`}
                  stroke="rgba(138,43,226,0.05)" strokeWidth={0.4} />
              ))}
              {Array.from({ length: 19 }).map((_, i) => (
                <Path key={`v-${i}`} d={`M${(i+1)*50},0 L${(i+1)*50},500`}
                  stroke="rgba(138,43,226,0.05)" strokeWidth={0.4} />
              ))}
              {/* Equator */}
              <Path d="M0,250 L1000,250" stroke="rgba(138,43,226,0.1)"
                strokeWidth={0.5} strokeDasharray="6,4" />

              {/* Real continent shapes - outer glow */}
              {(MAP_PATHS as string[]).map((d, i) => (
                <Path key={`g-${i}`} d={d}
                  fill="none"
                  stroke="rgba(0,255,255,0.12)"
                  strokeWidth={4}
                  strokeLinejoin="round" />
              ))}
              {/* Real continent shapes - fill + border */}
              {(MAP_PATHS as string[]).map((d, i) => (
                <Path key={`f-${i}`} d={d}
                  fill="rgba(0,255,255,0.06)"
                  stroke="rgba(0,255,255,0.5)"
                  strokeWidth={0.8}
                  strokeLinejoin="round" />
              ))}
            </Svg>

            {/* Player pins */}
            {playerPins.map((pin, i) => (
              <PlayerPin key={`pin-${i}`} x={pin.x} y={pin.y}
                name={pin.name} color={pin.color} />
            ))}

            {/* Target opponent pin */}
            {targetPin && opponent && (
              <PlayerPin x={targetPin.x} y={targetPin.y}
                name={opponent.pseudo}
                color={oppIsGlow ? '#00FFFF' : '#FF3B5C'}
                isTarget />
            )}
          </Animated.View>

          {/* Vignette edges */}
          <LinearGradient
            colors={['#050510', 'transparent', 'transparent', '#050510']}
            locations={[0, 0.12, 0.88, 1]}
            style={styles.vignetteV} />
          <LinearGradient
            colors={['#050510', 'transparent', 'transparent', '#050510']}
            locations={[0, 0.12, 0.88, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.vignetteH} />
        </View>

        {/* ── Search UI overlay ── */}
        {phase === 'searching' && (
          <View style={styles.searchOverlay}>
            <View style={styles.searchCard}>
              <LinearGradient
                colors={isChallengeMode ? ['rgba(191,95,255,0.15)', 'rgba(5,5,16,0.95)'] : ['rgba(138,43,226,0.12)', 'rgba(5,5,16,0.95)']}
                style={styles.searchCardGradient}>
                <View style={styles.categoryChip}>
                  <MaterialCommunityIcons name="sword-cross" size={14} color={isChallengeMode ? '#BF5FFF' : '#8A2BE2'} />
                  <Text style={[styles.categoryLabel, isChallengeMode && { color: '#BF5FFF' }]}>{getCategoryLabel()}</Text>
                </View>
                <View style={styles.scannerRow}>
                  <View style={[styles.scannerDot, isChallengeMode && { backgroundColor: '#BF5FFF' }]} />
                  <Text style={styles.searchMessage}>
                    {isChallengeMode
                      ? `${t('challenge.waiting_for')} ${challengeOpponentPseudo ? decodeURIComponent(challengeOpponentPseudo) : '...'}${dots}`
                      : `${message}${dots}`}
                  </Text>
                </View>
                <View style={styles.hintRow}>
                  <MaterialCommunityIcons name={isChallengeMode ? 'shield-sword' : 'earth'} size={14} color="#525252" />
                  <Text style={styles.hint}>
                    {isChallengeMode ? t('challenge.ready_title') : t('matchmaking.scanning_active')}
                  </Text>
                </View>
              </LinearGradient>
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.75}>
              <MaterialCommunityIcons name="close-circle-outline" size={18} color="#FF3B30" />
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── "Found" indicator ── */}
        {phase === 'found' && opponent && (
          <View style={styles.foundOverlay}>
            <View style={styles.foundCard}>
              <LinearGradient
                colors={['rgba(0,255,157,0.15)', 'rgba(5,5,16,0.9)']}
                style={styles.foundCardGradient}>
                <MaterialCommunityIcons name="target-account" size={24} color="#00FF9D" />
                <Text style={styles.foundText}>{t('matchmaking.opponent_located')}</Text>
                <Text style={styles.foundName}>{opponent.pseudo}</Text>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* ── Versus overlay ── */}
        {phase === 'versus' && opponent && (
          <>
            <Animated.View style={[styles.versusBackdrop, overlayStyle]} />
            <View style={styles.versusOverlay}>
              <View style={styles.versusContent}>
                <View style={styles.versusCategoryRow}>
                  <MaterialCommunityIcons name="sword-cross" size={16} color="#8A2BE2" />
                  <Text style={styles.versusCategory}>{getCategoryLabel()}</Text>
                </View>
                <View style={styles.versusPlayers}>
                  <Animated.View style={[styles.versusPlayer, playerStyle]}>
                    <LinearGradient colors={['#8A2BE2', '#6A1FCE']} style={styles.versusAvatar}>
                      <Text style={styles.versusAvatarText}>{pseudo[0]?.toUpperCase()}</Text>
                    </LinearGradient>
                    <Text style={styles.versusPseudo} numberOfLines={1}>{pseudo}</Text>
                    <View style={styles.versusLevelRow}>
                      <MaterialCommunityIcons name="star-outline" size={12} color="#525252" />
                      <Text style={styles.versusLevel}>{t('matchmaking.level_short')} {playerInfo?.level || 1}</Text>
                    </View>
                  </Animated.View>

                  <Animated.View style={[styles.vsBadge, vsAnimStyle]}>
                    <LinearGradient colors={['#8A2BE2', '#B24BF3']} style={styles.vsBadgeInner}>
                      <Text style={styles.vsBadgeText}>VS</Text>
                    </LinearGradient>
                  </Animated.View>

                  <Animated.View style={[styles.versusPlayer, opponentStyle]}>
                    <LinearGradient
                      colors={oppIsGlow ? ['#00CCCC', '#00FFFF'] : ['#FF3B30', '#CC2200']}
                      style={[styles.versusAvatar, oppIsGlow && styles.versusAvatarGlow]}>
                      <Text style={styles.versusAvatarText}>{opponent.pseudo[0]?.toUpperCase()}</Text>
                    </LinearGradient>
                    <View style={styles.versusPseudoRow}>
                      <Text style={[styles.versusPseudo, oppIsGlow && styles.glowPseudo]} numberOfLines={1}>
                        {opponent.pseudo}
                      </Text>
                      {oppBadgeIcon ? (
                        <MaterialCommunityIcons name={oppBadgeIcon as any} size={14}
                          color={oppIsGlow ? '#00FFFF' : '#FFA500'} />
                      ) : null}
                    </View>
                    <View style={styles.versusLevelRow}>
                      <MaterialCommunityIcons name="star-outline" size={12} color="#525252" />
                      <Text style={styles.versusLevel}>{t('matchmaking.level_short')} {opponent.level}</Text>
                    </View>
                    {opponent.title ? <Text style={styles.versusTitle}>{opponent.title}</Text> : null}
                    {opponent.streak >= 3 && (
                      <View style={[styles.streakTag, oppIsGlow && styles.streakTagGlow]}>
                        <MaterialCommunityIcons name={(oppBadgeIcon || 'fire') as any} size={12}
                          color={oppIsGlow ? '#00FFFF' : '#FFA500'} />
                        <Text style={[styles.streakText, oppIsGlow && { color: '#00FFFF' }]}>
                          {opponent.streak} {t('matchmaking.wins')}
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                </View>
                <View style={styles.versusHintRow}>
                  <MaterialCommunityIcons name="gamepad-variant" size={16} color="#525252" />
                  <Text style={styles.versusHint}>{t('matchmaking.duel_starting')}</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </View>

      {/* ── Challenge Timeout Modal ── */}
      {showTimeoutModal && (
        <View style={styles.timeoutOverlay}>
          <View style={styles.timeoutCard}>
            <MaterialCommunityIcons name="clock-alert-outline" size={40} color="#FF9F0A" style={{ marginBottom: 12 }} />
            <Text style={styles.timeoutTitle}>{t('challenge.timeout_title')}</Text>
            <Text style={styles.timeoutBody}>{t('challenge.timeout_body')}</Text>
            <View style={styles.timeoutButtons}>
              <TouchableOpacity
                style={styles.timeoutCancelBtn}
                onPress={() => { setShowTimeoutModal(false); router.replace('/(tabs)/accueil'); }}
                activeOpacity={0.8}
              >
                <Text style={styles.timeoutCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.timeoutPlayBtn}
                onPress={() => { setShowTimeoutModal(false); fetchBotOpponent(); }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#8A2BE2', '#00FFFF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.timeoutPlayGradient}
                >
                  <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFF" />
                  <Text style={styles.timeoutPlayText}>{t('challenge.play_now')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  mapViewport: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  mapContainer: { width: REAL_W, height: REAL_H, position: 'absolute' },
  vignetteV: { ...StyleSheet.absoluteFillObject },
  vignetteH: { ...StyleSheet.absoluteFillObject },

  searchOverlay: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' },
  searchCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(138,43,226,0.2)' },
  searchCardGradient: { paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', minWidth: SW * 0.8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(138,43,226,0.15)', paddingHorizontal: 14,
    paddingVertical: 6, borderRadius: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.25)',
  },
  categoryLabel: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  scannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  scannerDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#00FF9D',
    shadowColor: '#00FF9D', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 6,
  },
  searchMessage: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hint: { fontSize: 12, color: '#525252' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24,
    backgroundColor: 'rgba(255,59,48,0.12)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.35)',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#FF3B30' },

  foundOverlay: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' },
  foundCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,255,157,0.3)' },
  foundCardGradient: { paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', minWidth: SW * 0.7, gap: 6 },
  foundText: { fontSize: 16, fontWeight: '800', color: '#00FF9D' },
  foundName: { fontSize: 20, fontWeight: '900', color: '#FFF' },

  versusBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,5,16,0.85)' },
  versusOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  versusContent: { alignItems: 'center', paddingHorizontal: 24 },
  versusCategoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 48 },
  versusCategory: { fontSize: 16, fontWeight: '700', color: '#A3A3A3' },
  versusPlayers: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', width: '100%' },
  versusPlayer: { alignItems: 'center', flex: 1 },
  versusAvatar: {
    width: 72, height: 72, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12,
  },
  versusAvatarGlow: {
    shadowColor: '#00FFFF', shadowOpacity: 0.8, shadowRadius: 20,
    borderWidth: 2, borderColor: 'rgba(0,255,255,0.5)',
  },
  versusAvatarText: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  versusPseudoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  versusPseudo: { color: '#FFF', fontSize: 16, fontWeight: '800', maxWidth: 120 },
  glowPseudo: {
    color: '#00FFFF', textShadowColor: '#00FFFF',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
  },
  versusLevelRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  versusLevel: { color: '#525252', fontSize: 12, fontWeight: '600' },
  versusTitle: { color: '#8A2BE2', fontSize: 11, fontWeight: '700', marginTop: 3 },
  streakTag: {
    marginTop: 8, backgroundColor: 'rgba(255,100,0,0.12)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
    borderColor: 'rgba(255,100,0,0.25)', flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  streakTagGlow: { backgroundColor: 'rgba(0,255,255,0.1)', borderColor: 'rgba(0,255,255,0.3)' },
  streakText: { color: '#FFA500', fontSize: 11, fontWeight: '700' },

  vsBadge: {
    width: 56, height: 56, borderRadius: 28, overflow: 'hidden',
    marginHorizontal: 12, marginTop: 8,
    shadowColor: '#8A2BE2', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 20,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  vsBadgeInner: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 28 },
  vsBadgeText: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  versusHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 48 },
  versusHint: { color: '#525252', fontSize: 14, fontWeight: '600' },

  timeoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 200,
  },
  timeoutCard: {
    width: '100%',
    backgroundColor: '#0D0D1A',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,159,10,0.3)',
  },
  timeoutTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  timeoutBody: {
    fontSize: 14,
    color: '#A3A3A3',
    textAlign: 'center',
    marginBottom: 24,
  },
  timeoutButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  timeoutCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  timeoutCancelText: {
    color: '#A3A3A3',
    fontSize: 14,
    fontWeight: '700',
  },
  timeoutPlayBtn: {
    flex: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
  },
  timeoutPlayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 14,
  },
  timeoutPlayText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
