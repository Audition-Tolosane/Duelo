import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Image,
  Dimensions, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GLASS } from '../theme/glassTheme';
import { t, getLocale } from '../utils/i18n';
import SwipeBackPage from '../components/SwipeBackPage';
import UserAvatar from '../components/UserAvatar';
import { useWS } from '../contexts/WebSocketContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const CATEGORY_META: Record<string, { icon: string; color: string; nameKey: string }> = {
  series_tv: { icon: 'television-classic', color: '#E040FB', nameKey: 'chat.category.series_tv' },
  geographie: { icon: 'earth', color: '#00FFFF', nameKey: 'chat.category.geographie' },
  histoire: { icon: 'bank', color: '#FFD700', nameKey: 'chat.category.histoire' },
  cinema: { icon: 'movie-open', color: '#FF6B6B', nameKey: 'chat.category.cinema' },
  sport: { icon: 'soccer', color: '#00FF9D', nameKey: 'chat.category.sport' },
  musique: { icon: 'music-note', color: '#FF8C00', nameKey: 'chat.category.musique' },
  sciences: { icon: 'microscope', color: '#7B68EE', nameKey: 'chat.category.sciences' },
  gastronomie: { icon: 'silverware-fork-knife', color: '#FF69B4', nameKey: 'chat.category.gastronomie' },
};

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

  const handleRevanche = (gameData: any) => {
    if (gameData?.category) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      router.push(`/matchmaking?category=${gameData.category}`);
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

  // ── Game Card Component ──
  const GameCard = ({ data, isMe }: { data: any; isMe: boolean }) => {
    const cat = CATEGORY_META[data?.category] || { icon: 'controller-classic', color: '#8A2BE2', nameKey: '' };
    const won = data?.winner_id === myId;
    const myScore = isMe ? data?.sender_score : data?.receiver_score;
    const theirScore = isMe ? data?.receiver_score : data?.sender_score;

    return (
      <View style={[st.gameCard, { borderColor: cat.color + '40' }]}>
        {/* Game Card Header */}
        <LinearGradient
          colors={[cat.color + '30', 'transparent']}
          style={st.gameCardHeader}
        >
          <View style={st.gameCardCategoryRow}>
            <MaterialCommunityIcons name={cat.icon as any} size={16} color={cat.color} />
            <Text style={st.gameCardCategory}> {cat.nameKey ? t(cat.nameKey) : 'Quiz'}</Text>
          </View>
          <View style={[st.gameCardResultBadge, { backgroundColor: won ? '#00FF9D20' : '#FF6B6B20' }]}>
            <View style={st.gameCardResultRow}>
              <MaterialCommunityIcons
                name={won ? 'trophy' : 'skull'}
                size={13}
                color={won ? '#00FF9D' : '#FF6B6B'}
              />
              <Text style={[st.gameCardResultText, { color: won ? '#00FF9D' : '#FF6B6B' }]}>
                {' '}{won ? t('chat.victory') : t('chat.defeat')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Score */}
        <View style={st.gameCardScore}>
          <View style={st.scoreColumn}>
            <Text style={st.scoreName}>{t('chat.me')}</Text>
            <Text style={[st.scoreValue, { color: won ? '#00FF9D' : '#FF6B6B' }]}>{myScore ?? '?'}</Text>
          </View>
          <Text style={st.scoreVs}>VS</Text>
          <View style={st.scoreColumn}>
            <Text style={st.scoreName}>{partnerPseudo}</Text>
            <Text style={[st.scoreValue, { color: won ? '#FF6B6B' : '#00FF9D' }]}>{theirScore ?? '?'}</Text>
          </View>
        </View>

        {/* XP Gained */}
        {data?.xp_gained && (
          <Text style={st.gameCardXp}>+{data.xp_gained} {t('chat.xp_earned')}</Text>
        )}

        {/* Revanche Button */}
        <TouchableOpacity
          style={st.revanchemBtn}
          onPress={() => handleRevanche(data)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#8A2BE2', '#00BFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={st.revancheGradient}
          >
            <View style={st.revancheContent}>
              <MaterialCommunityIcons name="sword-cross" size={16} color="#FFF" />
              <Text style={st.revancheText}> {t('chat.rematch')}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Image Message ──
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

  // ── Render Message ──
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === myId;
    const msgType = item.message_type || 'text';

    // Show date separator if needed
    const showDate = index === 0 || (
      new Date(item.created_at).toDateString() !==
      new Date(messages[index - 1]?.created_at).toDateString()
    );

    const dateSeparator = showDate ? (
      <View style={st.dateSeparator}>
        <View style={st.dateLine} />
        <Text style={st.dateText}>
          {new Date(item.created_at).toLocaleDateString(getLocale(), {
            weekday: 'long', day: 'numeric', month: 'long'
          })}
        </Text>
        <View style={st.dateLine} />
      </View>
    ) : null;

    return (
      <View>
        {dateSeparator}
        <View style={[st.msgRow, isMe ? st.msgRowRight : st.msgRowLeft]}>
          {/* Opponent avatar */}
          {!isMe && (
            <View style={st.msgAvatar}>
              <UserAvatar avatarUrl={partnerAvatarUrl || undefined} avatarSeed={partnerAvatarSeed || partnerPseudo || ''} pseudo={partnerPseudo || '?'} size={30} />
            </View>
          )}

          <View style={st.msgContent}>
            {/* Game Card */}
            {msgType === 'game_card' && item.extra_data ? (
              <GameCard data={item.extra_data} isMe={isMe} />
            ) : msgType === 'image' && item.extra_data ? (
              /* Image Message */
              <View style={[st.msgBubbleWrap, isMe ? st.msgBubbleWrapRight : null]}>
                {isMe ? (
                  <LinearGradient
                    colors={['#8A2BE2', '#00BFFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[st.msgBubble, st.myBubble]}
                  >
                    <ImageMessage data={item.extra_data} />
                    <Text style={st.msgTimeInner}>{formatTime(item.created_at)}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[st.msgBubble, st.theirBubble]}>
                    <ImageMessage data={item.extra_data} />
                    <Text style={st.theirMsgTime}>{formatTime(item.created_at)}</Text>
                  </View>
                )}
              </View>
            ) : (
              /* Text Message */
              <View style={[st.msgBubbleWrap, isMe ? st.msgBubbleWrapRight : null]}>
                {isMe ? (
                  <LinearGradient
                    colors={['#8A2BE2', '#00BFFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[st.msgBubble, st.myBubble]}
                  >
                    <Text style={st.myMsgText}>{item.content}</Text>
                    <View style={st.msgFooter}>
                      <Text style={st.msgTimeInner}>{formatTime(item.created_at)}</Text>
                      {item.read && <MaterialCommunityIcons name="check-all" size={12} color="#00BFFF" />}
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={[st.msgBubble, st.theirBubble]}>
                    <Text style={st.theirMsgText}>{item.content}</Text>
                    <Text style={st.theirMsgTime}>{formatTime(item.created_at)}</Text>
                  </View>
                )}
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
      <View style={[st.container, { paddingTop: insets.top }]}>
        <View style={st.header}>
          <TouchableOpacity onPress={() => router.back()} style={st.headerBack}>
            <MaterialCommunityIcons name="chevron-left" size={26} color="#FFF" />
          </TouchableOpacity>
          <View style={st.headerCenter}>
            <View style={st.headerInfo}>
              <Text style={st.headerName}>{partnerPseudo || t('chat.player')}</Text>
            </View>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={st.loadingContainer}>
          <ActivityIndicator size="large" color="#8A2BE2" />
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 12, fontWeight: '600' }}>{t('chat.loading_messages')}</Text>
        </View>
      </View>
      </SwipeBackPage>
    );
  }

  return (
    <SwipeBackPage>
    <View style={[st.container, { paddingTop: insets.top }]}>
      {/* Premium Header */}
      <View style={st.header}>
        <TouchableOpacity data-testid="chat-back-button" onPress={() => router.back()} style={st.headerBack}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={st.headerCenter}
          onPress={() => router.push(`/player-profile?id=${partnerId}`)}
          activeOpacity={0.7}
        >
          <View style={st.headerAvatar}>
            <UserAvatar
              avatarUrl={partnerAvatarUrl || undefined}
              avatarSeed={partnerAvatarSeed || partnerPseudo || ''}
              pseudo={partnerPseudo || '?'}
              size={42}
            />
          </View>
          <View style={st.headerInfo}>
            <Text style={st.headerName}>{partnerPseudo || t('chat.player')}</Text>
            <View style={st.headerOnlineRow}>
              <View style={st.onlineDot} />
              <Text style={st.headerSub}>{isTyping ? t('chat.typing') : t('chat.online')}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Messages */}
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
              <LinearGradient
                colors={['#8A2BE2', '#00BFFF']}
                style={st.emptyChatCircle}
              >
                <MaterialCommunityIcons name="chat-outline" size={36} color="#FFF" />
              </LinearGradient>
              <Text style={st.emptyChatText}>{t('chat.start_conversation')}</Text>
              <Text style={st.emptyChatSub}>{t('chat.challenge_share')}</Text>
              <View style={st.emptyChatTtlRow}>
                <MaterialCommunityIcons name="pin" size={13} color="#525252" />
                <Text style={st.emptyChatTtl}> {t('chat.messages_expire')}</Text>
              </View>
            </View>
          }
        />

        {/* Quick Replies */}
        {!text.trim() && (
          <View style={st.quickRepliesRow}>
            {(['GG ! 🏆', 'Bien joué ! 👏', 'Revanche ? ⚔️', 'Trop fort ! 🔥', '😂'] as const).map((reply) => (
              <TouchableOpacity
                key={reply}
                style={st.quickReplyChip}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  wsSend({ action: 'chat_send', receiver_id: partnerId, content: reply, message_type: 'text' });
                }}
                activeOpacity={0.7}
              >
                <Text style={st.quickReplyText}>{reply}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Premium Input Bar */}
        <View style={[st.inputWrapper, { paddingBottom: insets.bottom }]}>
          <View style={st.inputRow}>
            {/* Image Picker Button */}
            <TouchableOpacity style={st.attachBtn} onPress={handleSendImage}>
              <MaterialCommunityIcons name="camera-outline" size={22} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            {/* Text Input */}
            <View style={st.inputContainer}>
              <TextInput
                data-testid="chat-input"
                style={st.input}
                placeholder={t('chat.your_message')}
                placeholderTextColor="#525252"
                value={text}
                onChangeText={handleTextChange}
                multiline
                maxLength={500}
              />
            </View>

            {/* Send Button */}
            <TouchableOpacity
              data-testid="chat-send-button"
              onPress={handleSend}
              disabled={!text.trim() || sending}
              activeOpacity={0.7}
            >
              {text.trim() ? (
                <LinearGradient
                  colors={['#8A2BE2', '#00BFFF']}
                  style={st.sendBtn}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <MaterialCommunityIcons name="arrow-up" size={20} color="#FFF" />
                  )}
                </LinearGradient>
              ) : (
                <View style={[st.sendBtn, st.sendBtnInactive]}>
                  <MaterialCommunityIcons name="arrow-up" size={20} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
    </SwipeBackPage>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },

  // Premium Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(138,43,226,0.15)',
    backgroundColor: 'rgba(138,43,226,0.03)',
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center', marginRight: 4,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  headerInfo: { flex: 1 },
  headerName: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  headerOnlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#00FF9D' },
  headerSub: { color: '#00FF9D', fontSize: 11, fontWeight: '600' },
  headerAction: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Messages
  messagesList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },

  // Date Separator
  dateSeparator: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 16, paddingHorizontal: 16,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  dateText: {
    color: '#525252', fontSize: 11, fontWeight: '600', paddingHorizontal: 12,
    textTransform: 'capitalize',
  },

  // Message Row
  msgRow: { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-end' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },

  msgAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: 6, marginBottom: 2,
  },
  msgAvatarText: { color: '#A3A3A3', fontSize: 12, fontWeight: '800' },

  msgContent: { maxWidth: '75%' },
  msgBubbleWrap: {},
  msgBubbleWrapRight: { alignItems: 'flex-end' },

  // Bubbles
  msgBubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden' },
  myBubble: { borderBottomRightRadius: 6 },
  theirBubble: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },

  // Text
  myMsgText: { color: '#FFF', fontSize: 15, lineHeight: 21 },
  theirMsgText: { color: '#E0E0E0', fontSize: 15, lineHeight: 21 },

  // Time
  msgFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4 },
  msgTimeInner: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'right', marginTop: 3 },
  theirMsgTime: { fontSize: 10, color: '#525252', marginTop: 3 },

  // Image Message
  imageMessage: {
    width: SCREEN_WIDTH * 0.55, height: SCREEN_WIDTH * 0.55 * 0.75,
    borderRadius: 12, marginBottom: 4,
  },

  // Game Card
  gameCard: {
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, width: SCREEN_WIDTH * 0.65,
  },
  gameCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  gameCardCategoryRow: { flexDirection: 'row', alignItems: 'center' },
  gameCardCategory: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  gameCardResultBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  gameCardResultRow: { flexDirection: 'row', alignItems: 'center' },
  gameCardResultText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  gameCardScore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 16, gap: 16,
  },
  scoreColumn: { alignItems: 'center', flex: 1 },
  scoreName: { color: '#A3A3A3', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  scoreValue: { fontSize: 32, fontWeight: '900' },
  scoreVs: { color: '#525252', fontSize: 14, fontWeight: '900', letterSpacing: 2 },

  gameCardXp: {
    color: '#00BFFF', fontSize: 12, fontWeight: '700', textAlign: 'center',
    paddingBottom: 8,
  },

  revanchemBtn: { margin: 10, borderRadius: 14, overflow: 'hidden' },
  revancheGradient: {
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
    borderRadius: 14,
  },
  revancheContent: { flexDirection: 'row', alignItems: 'center' },
  revancheText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },

  // Empty Chat
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyChatCircle: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyChatText: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  emptyChatSub: { color: '#A3A3A3', fontSize: 14, marginBottom: 20 },
  emptyChatTtlRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, overflow: 'hidden',
  },
  emptyChatTtl: {
    color: '#525252', fontSize: 12, fontWeight: '600',
  },

  // Quick Replies
  quickRepliesRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(138,43,226,0.08)',
  },
  quickReplyChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(138,43,226,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(138,43,226,0.3)',
  },
  quickReplyText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },

  // Premium Input Bar
  inputWrapper: {
    borderTopWidth: 1, borderTopColor: 'rgba(138,43,226,0.12)',
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 10, gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  attachBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  inputContainer: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    paddingHorizontal: 16, paddingVertical: 12, color: '#FFF', fontSize: 15, maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnInactive: { backgroundColor: '#1A1A2E' },
});
