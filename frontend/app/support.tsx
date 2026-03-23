import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import { t } from '../utils/i18n';

const CATEGORIES = ['bug', 'suggestion', 'account', 'other'] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_CONFIG: Record<Category, { icon: string; colors: [string, string]; key: string }> = {
  bug: { icon: 'bug-outline', colors: ['#FF3B5C', '#FF6B81'], key: 'support.bug' },
  suggestion: { icon: 'lightbulb-on-outline', colors: ['#FFB800', '#FFC933'], key: 'support.suggestion' },
  account: { icon: 'account-outline', colors: ['#00D4FF', '#38BDF8'], key: 'support.account' },
  other: { icon: 'dots-horizontal-circle-outline', colors: ['#6B7280', '#9CA3AF'], key: 'support.other' },
};

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const handleSend = () => {
    if (!message.trim() || !selectedCategory) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
  };

  const handleReset = () => {
    setSent(false);
    setMessage('');
    setSelectedCategory(null);
  };

  return (
    <SwipeBackPage>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <DueloHeader />

        {/* Sub-header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <MaterialCommunityIcons name="chevron-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <MaterialCommunityIcons name="headset" size={18} color="#6C63FF" />
            <Text style={styles.headerTitle}>{t('support.title')}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {sent ? (
              /* ── Success State ── */
              <View style={styles.successCard}>
                <LinearGradient
                  colors={['rgba(108,99,255,0.15)', 'rgba(108,99,255,0.05)']}
                  style={styles.successGradient}
                >
                  <LinearGradient colors={['#6C63FF', '#8A82FF']} style={styles.successIconCircle}>
                    <MaterialCommunityIcons name="check-circle" size={32} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.successTitle}>{t('support.success_title')}</Text>
                  <Text style={styles.successText}>{t('support.success_text')}</Text>
                  <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
                    <Text style={styles.resetBtnText}>{t('support.send')}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ) : (
              <>
                {/* ── Category Picker ── */}
                <View style={styles.sectionHeaderRow}>
                  <MaterialCommunityIcons name="tag-outline" size={14} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.sectionTitle}>{t('support.category')}</Text>
                </View>

                <View style={styles.categoriesRow}>
                  {CATEGORIES.map((cat) => {
                    const config = CATEGORY_CONFIG[cat];
                    const isSelected = selectedCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryChip,
                          isSelected && { borderColor: config.colors[0], backgroundColor: config.colors[0] + '18' },
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedCategory(cat);
                        }}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={isSelected ? config.colors : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.03)']}
                          style={styles.categoryIconWrap}
                        >
                          <MaterialCommunityIcons
                            name={config.icon as any}
                            size={16}
                            color={isSelected ? '#FFF' : 'rgba(255,255,255,0.4)'}
                          />
                        </LinearGradient>
                        <Text style={[
                          styles.categoryLabel,
                          isSelected && { color: config.colors[0] },
                        ]}>
                          {t(config.key)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ── Message Input ── */}
                <View style={styles.inputCard}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('support.message_placeholder')}
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    value={message}
                    onChangeText={setMessage}
                  />
                </View>

                {/* ── Send Button ── */}
                <TouchableOpacity
                  onPress={handleSend}
                  activeOpacity={0.8}
                  disabled={!message.trim() || !selectedCategory}
                >
                  <LinearGradient
                    colors={
                      message.trim() && selectedCategory
                        ? ['#6C63FF', '#8A82FF']
                        : ['rgba(108,99,255,0.3)', 'rgba(108,99,255,0.15)']
                    }
                    style={styles.sendBtn}
                  >
                    <MaterialCommunityIcons name="send" size={18} color="#FFF" />
                    <Text style={styles.sendBtnText}>{t('support.send')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* ── Contact Email ── */}
            <View style={styles.emailCard}>
              <LinearGradient colors={['#6C63FF', '#8A82FF']} style={styles.emailIconCircle}>
                <MaterialCommunityIcons name="email-outline" size={14} color="#FFF" />
              </LinearGradient>
              <View style={styles.emailTextWrap}>
                <Text style={styles.emailLabel}>{t('support.email_label')}</Text>
                <TouchableOpacity onPress={() => Linking.openURL('mailto:support@duelo-app.com')}>
                  <Text style={styles.emailAddress}>support@duelo-app.com</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── App Version ── */}
            <View style={styles.versionWrap}>
              <Text style={styles.versionLabel}>{t('support.version')}</Text>
              <Text style={styles.versionValue}>{appVersion}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SwipeBackPage>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(108,99,255,0.15)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  /* Section Header */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  /* Categories */
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  categoryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },

  /* Input */
  inputCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
    overflow: 'hidden',
  },
  textInput: {
    color: '#FFF',
    fontSize: 15,
    padding: 16,
    minHeight: 140,
    lineHeight: 22,
  },

  /* Send Button */
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 28,
  },
  sendBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Success */
  successCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
  },
  successGradient: {
    padding: 28,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  resetBtn: {
    backgroundColor: 'rgba(108,99,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.3)',
  },
  resetBtnText: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Email Card */
  emailCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  emailIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  emailTextWrap: {
    flex: 1,
  },
  emailLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  emailAddress: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6C63FF',
  },

  /* Version */
  versionWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  versionLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  versionValue: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.15)',
    fontWeight: '700',
  },
});
