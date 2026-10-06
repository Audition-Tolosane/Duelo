import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, TextInput, FlatList, ScrollView, KeyboardAvoidingView, Platform, Keyboard, Image, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { t, getLocale } from '../utils/i18n';
import SwipeBackPage from '../components/SwipeBackPage';
import UserAvatar from '../components/UserAvatar';
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

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { partnerId, partnerPseudo, partnerAvatarSeed, partnerAvatarUrl } = useLocalSearchParams<{ partnerId: string; partnerPseudo: string; partnerAvatarSeed: string; partnerAvatarUrl: string }>();
  const { send: wsSend, on: wsOn, decrementUnread } = useWS();
  const [myId, setMyId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    init();
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
          decrementUnread(1); // We're reading it right now
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
    }
    setLoading(false);
  };

  const fetchMessages = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chat/${uid}/messages?with_user=${partnerId}`);
      const data = await res.json();
      setMessages(data);
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
      router.push(`/player-profile?id=${partnerId}&challenge=1&themeId=${gameData.category}&themeName=${encodeURIComponent(gameData.category_name || gameData.theme_name || '')}` as any);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    const locale = getLocale();
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return time;
    if (diffDays === 1) return `${t('chat.yesterday')} ${time}`;
    if (diffDays < 7) return `${d.toLocaleDateString(locale, { weekday: 'short' })} ${time}`;
    return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }) + ` ${time}`;
  };

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
    const msgType = item.message_type || 'text';
    const fg = isMe ? COLOR.text.onAction : COLOR.text.primary;
    const timeColor = isMe ? COLOR.text.onAction : COLOR.text.tertiary;

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
        <View style={[st.msgRow, isMe ? st.msgRowRight : st.msgRowLeft]}>
          {!isMe && (
            <UserAvatar avatarUrl={partnerAvatarUrl || undefined} avatarSeed={partnerAvatarSeed || partnerPseudo || ''} pseudo={partnerPseudo || '?'} size={30} />
          )}

          <View style={st.msgContent}>
            {msgType === 'game_card' && item.extra_data ? (
              <GameCard data={item.extra_data} isMe={isMe} />
            ) : (
              <View style={[st.msgBubble, isMe ? st.myBubble : st.theirBubble]}>
                {msgType === 'image' && item.extra_data
                  ? <ImageMessage data={item.extra_data} />
                  : <Txt variant="body" color={fg}>{item.content}</Txt>}
                <View style={st.msgFooter}>
                  <Txt variant="caption" color={timeColor} style={isMe ? st.myTime : null}>{formatTime(item.created_at)}</Txt>
                  {isMe && item.read && msgType !== 'image' ? <Icon name="readAll" size={ICON_SIZE.sm} color={COLOR.text.onAction} /> : null}
                </View>
              </View>
            )}
          </View>
        </View>
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
      </View>

      <KeyboardAvoidingView style={st.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={st.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
        <View style={[st.inputWrapper, { paddingBottom: insets.bottom + SPACE.sm }]}>
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
  dateLine: { flex: 1, height: BORDER.hair, backgroundColor: COLOR.border.subtle },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgContent: { maxWidth: '80%' },
  msgBubble: { borderRadius: RADII.lg, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, gap: SPACE.xs },
  myBubble: { backgroundColor: COLOR.player.self, borderBottomRightRadius: RADII.xs },
  theirBubble: {
    backgroundColor: COLOR.surface.card, borderBottomLeftRadius: RADII.xs,
    borderWidth: BORDER.hair, borderColor: COLOR.border.subtle,
  },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: SPACE.xs },
  myTime: { opacity: 0.7 },
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
