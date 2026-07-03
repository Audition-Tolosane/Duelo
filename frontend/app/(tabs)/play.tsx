import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTabBar } from '../../contexts/TabBarContext';
import { t } from '../../utils/i18n';
import { FONTS } from '../../theme/fonts';

const CYAN = '#00E5FF';
const VIOLET = '#B366FF';
const GOLD = '#FFB547';
const FIRE = '#FF6B2C';

// Écran 18 du handoff — modes de jeu purs. Les univers/thèmes vivent
// dans l'onglet Thèmes (écran 6) ; pas de section univers ici.
export default function PlayScreen() {
  const router = useRouter();
  const { onScroll: onTabScroll } = useTabBar();

  // Les tournois ont lieu du vendredi au dimanche (cf. crons backend)
  const day = new Date().getDay();
  const isTournamentLive = day === 5 || day === 6 || day === 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} onScroll={onTabScroll} scrollEventThrottle={16}>

          {/* Header — modes de jeu (loupe retirée : doublon avec le header global) */}
          <View style={styles.pageHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modesEyebrow}>◆ {t('play.modes_eyebrow')}</Text>
              <Text style={styles.modesTitle}>{t('play.modes_title')}</Text>
            </View>
          </View>

          {/* Quick Match — gros bloc gradient */}
          <Animated.View entering={FadeInDown.duration(450)}>
            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.88}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                router.push('/matchmaking');
              }}
            >
              <LinearGradient
                colors={[CYAN, VIOLET]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.quickGradient}
              >
                <Text style={styles.quickWatermark}>⚔</Text>
                <Text style={styles.quickEyebrow}>◆ {t('play.random').toUpperCase()} · ~8s</Text>
                <Text style={styles.quickTitle}>QUICK MATCH</Text>
                <Text style={styles.quickSub}>{t('play.quick_sub')}</Text>
                <View style={styles.quickCta}>
                  <Text style={styles.quickCtaText}>{t('tournament.play_now')} →</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Autres modes */}
          <Animated.View entering={FadeInDown.delay(80).duration(450)}>
            <TouchableOpacity
              style={[styles.modeRow, { backgroundColor: 'rgba(179,102,255,0.07)', borderColor: 'rgba(179,102,255,0.21)' }]}
              activeOpacity={0.85}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(tabs)/players');
              }}
            >
              <View style={[styles.modeIconTile, { backgroundColor: 'rgba(179,102,255,0.15)', borderColor: 'rgba(179,102,255,0.31)' }]}>
                <MaterialCommunityIcons name="sword-cross" size={24} color={VIOLET} />
              </View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeTitle}>{t('play.challenge_friend')}</Text>
                <Text style={styles.modeSub}>{t('play.challenge_friend_sub')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={VIOLET} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeRow, { backgroundColor: 'rgba(255,181,71,0.07)', borderColor: 'rgba(255,181,71,0.21)' }]}
              activeOpacity={0.85}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/tournament');
              }}
            >
              <View style={[styles.modeIconTile, { backgroundColor: 'rgba(255,181,71,0.15)', borderColor: 'rgba(255,181,71,0.31)' }]}>
                <MaterialCommunityIcons name="trophy" size={24} color={GOLD} />
              </View>
              <View style={styles.modeInfo}>
                <View style={styles.modeTitleRow}>
                  <Text style={styles.modeTitle}>{t('tournament.weekend_title')}</Text>
                  {isTournamentLive && (
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modeSub}>{t('tournament.weekend_hint')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={GOLD} />
            </TouchableOpacity>

            {/* Champ de bataille — renvoi vers l'onglet Thèmes (même intitulé que sa destination) */}
            <TouchableOpacity
              style={[styles.modeRow, { backgroundColor: 'rgba(0,229,255,0.07)', borderColor: 'rgba(0,229,255,0.21)' }]}
              activeOpacity={0.85}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(tabs)/themes');
              }}
            >
              <View style={[styles.modeIconTile, { backgroundColor: 'rgba(0,229,255,0.15)', borderColor: 'rgba(0,229,255,0.31)' }]}>
                <MaterialCommunityIcons name="compass-outline" size={24} color={CYAN} />
              </View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeTitle}>{t('play.arena_title')}</Text>
                <Text style={styles.modeSub}>{t('play.arena_sub')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={CYAN} />
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingBottom: 120 },

  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18,
  },
  modesEyebrow: {
    fontSize: 10, fontFamily: FONTS.mono.bold, color: CYAN,
    letterSpacing: 2.5, textTransform: 'uppercase',
  },
  modesTitle: {
    fontSize: 28, fontFamily: FONTS.display.bold, color: '#FFF',
    letterSpacing: -1, lineHeight: 31, marginTop: 4, textTransform: 'uppercase',
  },

  // Quick Match hero
  quickCard: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 22, overflow: 'hidden',
    shadowColor: VIOLET, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4, shadowRadius: 28, elevation: 10,
  },
  quickGradient: { padding: 22, overflow: 'hidden' },
  quickWatermark: {
    position: 'absolute', top: -24, right: -8,
    fontSize: 120, color: 'rgba(255,255,255,0.18)',
  },
  quickEyebrow: {
    fontSize: 9, fontFamily: FONTS.mono.bold, color: 'rgba(0,0,0,0.70)',
    letterSpacing: 2,
  },
  quickTitle: {
    fontSize: 32, fontFamily: FONTS.display.bold, color: '#000',
    letterSpacing: -1, lineHeight: 34, marginTop: 4,
  },
  quickSub: {
    fontSize: 12, fontFamily: FONTS.display.semiBold, color: 'rgba(0,0,0,0.65)',
    marginTop: 4,
  },
  quickCta: {
    alignSelf: 'flex-start', marginTop: 12,
    backgroundColor: '#000', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  quickCtaText: { color: '#FFF', fontSize: 13, fontFamily: FONTS.display.bold },

  // Lignes de modes
  modeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginBottom: 8,
    padding: 16, borderRadius: 16, borderWidth: 1,
  },
  modeIconTile: {
    width: 50, height: 50, borderRadius: 14, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  modeInfo: { flex: 1 },
  modeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeTitle: { fontSize: 16, fontFamily: FONTS.display.bold, color: '#FFF' },
  modeSub: { fontSize: 11, color: 'rgba(255,255,255,0.60)', marginTop: 2 },
  liveBadge: {
    backgroundColor: FIRE, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  liveBadgeText: {
    color: '#FFF', fontSize: 8, fontFamily: FONTS.display.bold, letterSpacing: 1,
  },
});
