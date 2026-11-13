import React, { useState, useEffect, useRef, useMemo } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, SharedValue } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import {
  View, StyleSheet, TextInput, FlatList, ScrollView, KeyboardAvoidingView, Platform, Keyboard, Image, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { isEmojiReaction, reactionLabel } from '../utils/reactions';
import { t, getLocale } from '../utils/i18n';
import { authFetch } from '../utils/api';
import SwipeBackPage from '../components/SwipeBackPage';
import UserAvatar from '../components/UserAvatar';
import ModerationSheet from '../components/ModerationSheet';
import { fetchBlockedIds } from '../utils/moderation';
import type { ReportTarget } from '../utils/moderation';
import { useWS } from '../contexts/WebSocketContext';
import {
  Txt, Icon, Button, IconButton, BackButton, Badge, Card, Chip, ScreenContainer, EmptyState, Loader, ThemeIcon,
} from '../components/ui';
import type { ThemeIconName } from '../theme/themeIcons.generated';
import { COLOR, SPACE, RADII, BORDER, SIZE, ICON_SIZE, TYPO } from '../theme/tokens';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Anciennes catégories des cartes de match : seul le nom traduit reste, l'icône vient des SVG SKILKI.
// Catégories historiques qui ont une illustration SKILKI du même nom
const CATEGORY_ILLUSTRATION: ThemeIconName[] = ['cinema', 'geographie', 'histoire', 'sport', 'musique', 'sciences', 'gastronomie'];

const CATEGORY_NAME_KEY: Record<string, string> = {
  series_tv: 'chat.category.series_tv',
  geographie: 'chat.category.geographie',
  histoire: 'chat.category.histoire',
  cinema: 'chat.category.cinema',
  sport: 'chat.category.sport',
  musique: 'chat.category.musique',
  sciences: 'chat.category.sciences',
  gastronomie: 'chat.category.gastronomie',
};

// Réponses rapides (texte envoyé tel quel, sans emoji d'interface)
const QUICK_REPLIES = ['pilot.chat.quick_gg', 'pilot.chat.quick_well_played', 'pilot.chat.quick_rematch', 'pilot.chat.quick_too_good'] as const;

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: string;
  extra_data: any;
  read: boolean;
  created_at: string;
};

// Glisser la conversation vers la gauche fait apparaître l'heure de chaque message (comme Instagram)
const TIME_W = 64;

function SwipeTimeRow({ reveal, time, children }: { reveal: SharedValue<number>; time: string; children: React.ReactNode }) {
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -reveal.value }] }));
  const timeStyle = useAnimatedStyle(() => ({ opacity: reveal.value / TIME_W }));
  return (
    <Animated.View style={rowStyle}>
      {children}
      <Animated.View style={[st.swipeTime, timeStyle]} pointerEvents="none">
        <Txt variant="caption" color={COLOR.text.tertiary}>{time}</Txt>
      </Animated.View>
    </Animated.View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { partnerId, partnerPseudo, partnerAvatarSeed, partnerAvatarUrl } = useLocalSearchParams<{ partnerId: string; partnerPseudo: string; partnerAvatarSeed: string; partnerAvatarUrl: string }>();
  const { send: wsSend, on: wsOn, refreshUnread } = useWS();
  const [myId, setMyId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [modTarget, setModTarget] = useState<{ type: ReportTarget; id: string } | null>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { fetchBlockedIds().then((ids) => setBlocked(ids.has(String(partnerId)))); }, [partnerId]);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    init();
  }, []);

  // Clavier ouvert : la liste rétrécit mais garde son décalage, les derniers messages passaient
  // sous la saisie. On redescend en bas à chaque ouverture (et on retire la marge du bas d'écran).
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const toEnd = () => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    const subs = [
      Keyboard.addListener(showEvt, () => { setKeyboardOpen(true); toEnd(); }),
      Keyboard.addListener('keyboardDidShow', toEnd),
      Keyboard.addListener(hideEvt, () => setKeyboardOpen(false)),
    ];
    return () => subs.forEach((x) => x.remove());
  }, []);

  // Listen for real-time messages and typing via WebSocket
  useEffect(() => {
    if (!myId) return;

    const unsubs = [
      // Incoming message from this conversation partner
      wsOn('chat_message', (msg) => {
        if (msg.data?.sender_id === partnerId) {
          // #39 — dedup by message ID (message may already be in list from initial fetch)
          setMessages((prev) => prev.some(m => m.id === msg.data.id) ? prev : [...prev, msg.data]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          // Lu à l'instant : on le marque lu côté serveur aussi, puis on recale la pastille.
          authFetch(`${API_URL}/api/chat/${myId}/read?with_user=${partnerId}`, { method: 'POST' })
            .catch(() => {})
            .finally(refreshUnread);
        }
      }),
      // Our own sent message confirmed
      wsOn('chat_sent', (msg) => {
        if (msg.data?.receiver_id === partnerId) {
          setMessages((prev) => {
            // Avoid duplicate if already added optimistically
            if (prev.some((m) => m.id === msg.data.id)) return prev;
            return [...prev, msg.data];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      }),
      // Typing indicator
      wsOn('chat_typing', (msg) => {
        if (msg.data?.sender_id === partnerId) {
          setIsTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
        }
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [myId, partnerId]);

  const init = async () => {
    const uid = await AsyncStorage.getItem('duelo_user_id');
    if (uid) {
      setMyId(uid);
      await fetchMessages(uid);
      // Le serveur vient de marquer la conversation lue : la pastille Messages doit suivre.
      refreshUnread();
    }
    setLoading(false);
  };

  const fetchMessages = async (uid: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/chat/${uid}/messages?with_user=${partnerId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch (e) { console.error(e); }
  };

  const handleSend = async () => {
    if (!text.trim() || !myId || sending) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const content = text.trim();
    setText('');
    Keyboard.dismiss();

    // Send via WebSocket for instant delivery
    wsSend({
      action: 'chat_send',
      receiver_id: partnerId,
      content,
      message_type: 'text',
    });

    setSending(false);
  };

  // Send typing indicator via WebSocket (throttled)
  const handleTextChange = (value: string) => {
    setText(value);
    if (value.trim() && partnerId) {
      wsSend({ action: 'chat_typing', receiver_id: partnerId });
    }
  };

  const handleSendImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Send via WebSocket
        wsSend({
          action: 'chat_send',
          receiver_id: partnerId,
          content: 'Image',
          message_type: 'image',
          extra_data: { image_base64: result.assets[0].base64.substring(0, 50000) },
        });

        setSending(false);
      }
    } catch {
      setSending(false);
    }
  };

  // Revanche depuis une conversation = défi nominatif envoyé à l'interlocuteur, sur ce thème.
  const handleRevanche = (gameData: any) => {
    if (gameData?.category && partnerId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      router.push(`/player-profile?id=${encodeURIComponent(String(partnerId))}&challenge=1&themeId=${encodeURIComponent(String(gameData.category || ""))}&themeName=${encodeURIComponent(gameData.category_name || gameData.theme_name || '')}` as any);
    }
  };

  const reveal = useSharedValue(0);
  // Vers la gauche seulement (vers la droite = retour, SwipeBackPage) ; le défilement vertical l'emporte
  const timePan = useMemo(() => Gesture.Pan()
    .activeOffsetX(-12)
    .failOffsetX(12)
    .failOffsetY([-12, 12])
    .onUpdate((e) => { reveal.value = Math.min(TIME_W, Math.max(0, -e.translationX)); })
    .onFinalize(() => { reveal.value = withSpring(0, { damping: 20, stiffness: 220 }); }),
  [reveal]);

  // ── Carte de match ──
  const GameCard = ({ data, isMe }: { data: any; isMe: boolean }) => {
    const nameKey = CATEGORY_NAME_KEY[data?.category];
    const themeName: string = nameKey ? t(nameKey) : (data?.category_name || data?.theme_name || t('pilot.chat.quiz'));
    const won = data?.winner_id === myId;
    const myScore = isMe ? data?.sender_score : data?.receiver_score;
    const theirScore = isMe ? data?.receiver_score : data?.sender_score;

    return (
      <Card style={st.gameCard}>
        <View style={st.gameCardHeader}>
          {/* Thème précis si connu, sinon l'illustration de la catégorie historique (cinema, sport…) */}
          <ThemeIcon
            themeName={data?.theme_name || themeName}
            name={!data?.theme_name && CATEGORY_ILLUSTRATION.includes(data?.category) ? data.category : undefined}
            size={ICON_SIZE.theme.xs}
          />
          <Txt variant="label" color={COLOR.text.primary} numberOfLines={1} style={st.flexShrink}>{themeName}</Txt>
          <Badge label={won ? t('chat.victory') : t('chat.defeat')} tone={won ? 'success' : 'neutral'} />
        </View>

        <View style={st.gameCardScore}>
          <View style={st.scoreColumn}>
            <Txt variant="overline" color={COLOR.player.self} numberOfLines={1}>{t('chat.me')}</Txt>
            <Txt variant="score" color={COLOR.player.self}>{myScore ?? '?'}</Txt>
          </View>
          <Txt variant="overline">VS</Txt>
          <View style={st.scoreColumn}>
            <Txt variant="overline" color={COLOR.player.opponentText} numberOfLines={1}>{partnerPseudo}</Txt>
            <Txt variant="score" color={COLOR.player.opponentText}>{theirScore ?? '?'}</Txt>
          </View>
        </View>

        {data?.xp_gained ? (
          <Txt variant="caption" color={COLOR.reward.gold} align="center">+{data.xp_gained} {t('chat.xp_earned')}</Txt>
        ) : null}

        <Button label={t('chat.rematch')} icon="duel" size="sm" onPress={() => handleRevanche(data)} />
      </Card>
    );
  };

  // ── Image ──
  const ImageMessage = ({ data }: { data: any }) => {
    if (!data?.image_base64) return null;
    return (
      <Image
        source={{ uri: `data:image/jpeg;base64,${data.image_base64}` }}
        style={st.imageMessage}
        resizeMode="cover"
      />
    );
  };

  // ── Message ──
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === myId;
    // Appui long sur un message reçu → le signaler
    const onLongPress = isMe ? undefined : () => setModTarget({ type: 'message', id: item.id });
    const msgType = item.message_type || 'text';
    const fg = isMe ? COLOR.text.onAction : COLOR.text.primary;

    const showDate = index === 0 || (
      new Date(item.created_at).toDateString() !==
      new Date(messages[index - 1]?.created_at).toDateString()
    );

    return (
      <View>
        {showDate ? (
          <View style={st.dateSeparator}>
            <View style={st.dateLine} />
            <Txt variant="caption">
              {new Date(item.created_at).toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
            </Txt>
            <View style={st.dateLine} />
          </View>
        ) : null}
        <SwipeTimeRow reveal={reveal} time={new Date(item.created_at).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}>
        <View style={[st.msgRow, isMe ? st.msgRowRight : st.msgRowLeft]}>
          {!isMe && (
            <UserAvatar avatarUrl={partnerAvatarUrl || undefined} avatarSeed={partnerAvatarSeed || partnerPseudo || ''} pseudo={partnerPseudo || '?'} size={30} />
          )}

          <Pressable style={st.msgContent} onLongPress={onLongPress} delayLongPress={350} disabled={!onLongPress}>
            {msgType === 'game_card' && item.extra_data ? (
              <GameCard data={item.extra_data} isMe={isMe} />
            ) : (
              <View style={[st.msgBubble, isMe ? st.myBubble : st.theirBubble]}>
                {msgType === 'image' && item.extra_data
                  ? <ImageMessage data={item.extra_data} />
                  : msgType === 'reaction'
                    // Réaction d'après-match : clé traduite (émoji en grand)
                    ? <Txt variant={isEmojiReaction(item.content) ? 'h1' : 'body'} color={fg}>{reactionLabel(item.content)}</Txt>
                    : <Txt variant="body" color={fg}>{item.content}</Txt>}
                {isMe && item.read && msgType !== 'image' ? (
                  <View style={st.msgFooter}>
                    <Icon name="readAll" size={ICON_SIZE.sm} color={COLOR.text.onAction} />
                  </View>
                ) : null}
              </View>
            )}
          </Pressable>
        </View>
        </SwipeTimeRow>
      </View>
    );
  };

  if (loading) {
    return (
      <SwipeBackPage>
      <ScreenContainer safeTop>
        <View style={st.header}>
          <BackButton />
          <Txt variant="h3" numberOfLines={1} style={st.flexShrink}>{partnerPseudo || t('chat.player')}</Txt>
        </View>
        <Loader label={t('chat.loading_messages')} fill />
      </ScreenContainer>
      </SwipeBackPage>
    );
  }

  const hasText = !!text.trim();

  return (
    <SwipeBackPage>
    <ScreenContainer safeTop>
      {/* En-tête : retour · interlocuteur (ouvre son profil) · Défier */}
      <View style={st.header}>
        <BackButton testID="chat-back-button" />
        <Pressable
          style={({ pressed }) => [st.headerCenter, pressed && st.pressed]}
          onPress={() => router.push(`/player-profile?id=${partnerId}`)}
          accessibilityRole="button"
        >
          <UserAvatar
            avatarUrl={partnerAvatarUrl || undefined}
            avatarSeed={partnerAvatarSeed || partnerPseudo || ''}
            pseudo={partnerPseudo || '?'}
            size={40}
          />
          <View style={st.headerInfo}>
            <Txt variant="cardTitle" numberOfLines={1}>{partnerPseudo || t('chat.player')}</Txt>
            <View style={st.headerOnlineRow}>
              <View style={st.onlineDot} />
              <Txt variant="caption" numberOfLines={1}>{isTyping ? t('chat.typing') : t('chat.online')}</Txt>
            </View>
          </View>
        </Pressable>
        {/* DÉFIER — ouvre le profil joueur (choix du thème + envoi du défi) */}
        <Button
          label={t('players.challenge')}
          icon="duel"
          size="sm"
          style={st.challengeBtn}
          onPress={() => router.push(`/player-profile?id=${partnerId}`)}
        />
        <IconButton icon="more" accessibilityLabel={t('mod.more')} onPress={() => setModTarget({ type: 'user', id: String(partnerId) })} testID="chat-more" />
      </View>

      <KeyboardAvoidingView style={st.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <GestureDetector gesture={timePan}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={st.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => { if (keyboardOpen) flatListRef.current?.scrollToEnd({ animated: false }); }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={st.emptyChat}>
              <EmptyState icon="message" title={t('chat.start_conversation')} message={t('chat.challenge_share')} />
              <View style={st.emptyChatTtlRow}>
                <Icon name="pin" size={ICON_SIZE.sm} color={COLOR.text.tertiary} />
                <Txt variant="caption">{t('chat.messages_expire')}</Txt>
              </View>
            </View>
          }
        />
        </GestureDetector>

        {/* Réponses rapides */}
        {!hasText && (
          // Une seule rangée qui défile (2 lignes de puces mangeaient l'écran en 320 px)
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={st.quickRepliesScroll} contentContainerStyle={st.quickRepliesRow}>
            {QUICK_REPLIES.map((key) => (
              <Chip
                key={key}
                label={t(key)}
                onPress={() => wsSend({ action: 'chat_send', receiver_id: partnerId, content: t(key), message_type: 'text' })}
              />
            ))}
          </ScrollView>
        )}

        {/* Saisie */}
        <View style={[st.inputWrapper, { paddingBottom: (keyboardOpen ? 0 : insets.bottom) + SPACE.sm }]}>
          <IconButton icon="camera" appearance="bare" accessibilityLabel={t('conversations.photo')} onPress={handleSendImage} />
          <View style={st.inputContainer}>
            <TextInput
              testID="chat-input"
              style={st.input}
              placeholder={t('chat.your_message')}
              placeholderTextColor={COLOR.text.tertiary}
              selectionColor={COLOR.action.primary}
              maxFontSizeMultiplier={1.3}
              value={text}
              onChangeText={handleTextChange}
              multiline
              maxLength={500}
              // Web : un textarea démarre sur 2 lignes ; on le ramène à une ligne comme sur mobile
              {...(Platform.OS === 'web' ? ({ rows: 1 } as object) : {})}
            />
          </View>
          <IconButton
            testID="chat-send-button"
            icon="arrowUp"
            active={hasText}
            accessibilityLabel={t('chat.send')}
            onPress={handleSend}
            style={hasText ? st.sendActive : null}
          />
        </View>
      </KeyboardAvoidingView>
      <ModerationSheet
        visible={!!modTarget}
        onClose={() => setModTarget(null)}
        target={modTarget}
        authorId={String(partnerId)}
        isBlocked={blocked}
        onBlockedChange={(b) => { setBlocked(b); if (b) router.back(); }}
      />
    </ScreenContainer>
    </SwipeBackPage>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  pressed: { opacity: 0.7 },

  // En-tête
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    paddingHorizontal: SPACE.md, minHeight: SIZE.header + 10,
    borderBottomWidth: BORDER.hair, borderBottomColor: COLOR.border.subtle,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flex: 1, minWidth: 0, minHeight: SIZE.touch },
  headerInfo: { flex: 1, minWidth: 0 },
  headerOnlineRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR.status.success },
  challengeBtn: { paddingHorizontal: SPACE.md },

  // Messages
  messagesList: { paddingHorizontal: SPACE.screenX, paddingVertical: SPACE.lg, gap: SPACE.sm, flexGrow: 1 },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginVertical: SPACE.md },
  dateLine: { flex: 1, height: BORDER.hair, backgroundColor: COLOR.border.default },
  swipeTime: { position: 'absolute', top: 0, bottom: 0, right: -TIME_W, width: TIME_W, alignItems: 'center', justifyContent: 'center' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgContent: { maxWidth: '80%' },
  msgBubble: { borderRadius: RADII.lg, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, gap: SPACE.xs },
  // Coins tous arrondis (plus d'angle côté expéditeur)
  myBubble: { backgroundColor: COLOR.accent.notif },
  theirBubble: {
    backgroundColor: COLOR.surface.card,
    borderWidth: BORDER.hair, borderColor: COLOR.border.subtle,
  },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: SPACE.xs },
  imageMessage: { width: 200, height: 200, borderRadius: RADII.md },

  // Carte de match
  gameCard: { width: 260, maxWidth: '100%', gap: SPACE.md },
  gameCardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  gameCardScore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: SPACE.sm },
  scoreColumn: { alignItems: 'center', flex: 1, minWidth: 0, gap: SPACE.xxs },

  // Conversation vide
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyChatTtlRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },

  // Réponses rapides
  quickRepliesScroll: { flexGrow: 0 },
  quickRepliesRow: { gap: SPACE.sm, paddingHorizontal: SPACE.screenX, paddingBottom: SPACE.sm },

  // Saisie
  inputWrapper: {
    flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.xs,
    paddingHorizontal: SPACE.sm, paddingTop: SPACE.sm,
    borderTopWidth: BORDER.hair, borderTopColor: COLOR.border.subtle,
    backgroundColor: COLOR.bg.primary,
  },
  inputContainer: {
    flex: 1, minHeight: SIZE.touch, maxHeight: 120, justifyContent: 'center',
    backgroundColor: COLOR.surface.input, borderRadius: RADII.md,
    borderWidth: BORDER.hair, borderColor: COLOR.border.default,
    paddingHorizontal: SPACE.md,
  },
  input: { ...TYPO.body, color: COLOR.text.primary, paddingVertical: SPACE.sm },
  sendActive: { backgroundColor: COLOR.action.selectedFill },
});
