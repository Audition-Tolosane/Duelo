import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useWS } from '../contexts/WebSocketContext';
import UserAvatar from './UserAvatar';
import { Icon, Txt } from './ui';
import { COLOR, PALETTE, SPACE, RADII, ELEVATION, alpha } from '../theme/tokens';
import { t } from '../utils/i18n';
import { reactionLabel } from '../utils/reactions';

// Bandeau « nouveau message » app ouverte (façon Instagram). Le serveur n'envoie pas de push
// quand le joueur est connecté : il reçoit le message par WebSocket (`chat_message`), et sans
// ce bandeau il ne voyait qu'un compteur changer. Toucher = ouvrir la conversation ;
// glisser vers le haut = fermer. Muet pendant un duel et dans la conversation déjà ouverte.
// Sur iOS, la plupart des écrans (résultats, chat, profil…) sont des modales natives : une vue
// posée à la racine passe DESSOUS. FullWindowOverlay l'affiche au-dessus de tout.

const VISIBLE_MS = 5000;
const SILENT_SCREENS = ['/game', '/matchmaking'];

type Incoming = {
  senderId: string;
  pseudo: string;
  preview: string;
  avatarSeed?: string;
  avatarUrl?: string | null;
};

function previewOf(data: any): string {
  if (data?.message_type === 'image') return t('conversations.photo');
  if (data?.message_type === 'game_card') return t('conversations.match_result');
  if (data?.message_type === 'reaction') return t('reaction.message_preview', { r: reactionLabel(String(data?.content || '')) });
  return String(data?.content || '');
}

export default function MessageBanner() {
  const { on } = useWS();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ partnerId?: string }>();
  // Lus dans le handler WS (abonné une seule fois) : des refs évitent des valeurs figées.
  const routeRef = useRef({ pathname, partnerId: params.partnerId });
  routeRef.current = { pathname, partnerId: params.partnerId };

  const [msg, setMsg] = useState<Incoming | null>(null);
  const slide = useRef(new Animated.Value(-200)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    Animated.timing(slide, { toValue: -200, duration: 220, useNativeDriver: true })
      .start(() => setMsg(null));
  };

  useEffect(() => {
    return on('chat_message', (event: any) => {
      const data = event?.data || {};
      const senderId = String(data.sender_id || '');
      if (!senderId) return;
      const { pathname: path, partnerId } = routeRef.current;
      if (SILENT_SCREENS.includes(path)) return;
      if (path === '/chat' && String(partnerId) === senderId) return;
      // Sur l'écran de résultats, la réaction de l'adversaire s'affiche déjà en bulle près de lui.
      if (path === '/results' && data.message_type === 'reaction') return;

      setMsg({
        senderId,
        pseudo: data.sender_pseudo || '',
        preview: previewOf(data),
        avatarSeed: data.sender_avatar_seed,
        avatarUrl: data.sender_avatar_url,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      slide.setValue(-200);
      Animated.spring(slide, { toValue: 0, tension: 90, friction: 11, useNativeDriver: true }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hide, VISIBLE_MS);
    });
  }, [on]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  // Glisser vers le haut pour fermer ; relâché trop tôt, le bandeau revient en place.
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
    onPanResponderMove: (_, g) => { if (g.dy < 0) slide.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy < -30 || g.vy < -0.5) hide();
      else Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  if (!msg) return null;

  const open = () => {
    const target = msg;
    hide();
    router.push(`/chat?partnerId=${target.senderId}&partnerPseudo=${encodeURIComponent(target.pseudo)}` as any);
  };

  const banner = (
    <Animated.View
      style={[styles.wrap, { top: insets.top + SPACE.xs, transform: [{ translateY: slide }] }]}
      {...pan.panHandlers}
    >
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${t('notif.new_message')} — ${msg.pseudo}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View>
          <UserAvatar avatarSeed={msg.avatarSeed} avatarUrl={msg.avatarUrl} pseudo={msg.pseudo} size={48} />
          <View style={styles.badge}>
            <Icon name="message" size={12} color={COLOR.text.onAction} />
          </View>
        </View>
        <View style={styles.text}>
          <Txt variant="overline" color={alpha(PALETTE.night, 0.6)} numberOfLines={1}>
            {t('notif.new_message')}
          </Txt>
          <Txt variant="cardTitle" color={PALETTE.night} numberOfLines={1}>{msg.pseudo}</Txt>
          <Txt variant="body" color={alpha(PALETTE.night, 0.78)} numberOfLines={2}>{msg.preview}</Txt>
        </View>
        <Icon name="chevronRight" size={20} color={alpha(PALETTE.night, 0.5)} />
      </Pressable>
    </Animated.View>
  );

  if (Platform.OS === 'ios') return <FullWindowOverlay>{banner}</FullWindowOverlay>;
  return banner;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: SPACE.screenX,
    right: SPACE.screenX,
    zIndex: 10000,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADII.lg,
    // Crème sur une app sombre : le bandeau saute aux yeux sur tous les écrans.
    backgroundColor: PALETTE.cream,
    borderLeftWidth: 4,
    borderLeftColor: PALETTE.coral,
    ...ELEVATION.e2,
    shadowOpacity: 0.45,
    elevation: 12,
  },
  badge: {
    position: 'absolute', right: -4, bottom: -4,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: PALETTE.coral, borderWidth: 2, borderColor: PALETTE.cream,
  },
  pressed: { opacity: 0.9 },
  text: { flex: 1, gap: 1 },
});
