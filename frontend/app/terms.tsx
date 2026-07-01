import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../utils/i18n';

const SECTION_COUNT = 11;

export default function Terms() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow}>◆ DUELO</Text>
          <Text style={styles.headerTitle}>{t('terms.title')}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdate}>{t('terms.last_update')}</Text>

        {Array.from({ length: SECTION_COUNT }, (_, i) => i + 1).map((n) => (
          <View key={n} style={[styles.section, n < SECTION_COUNT && styles.sectionBorder]}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionNum}>{String(n).padStart(2, '0')}</Text>
              <Text style={styles.sectionTitle}>{t(`terms.section${n}_title`)}</Text>
            </View>
            <Text style={styles.paragraph}>{t(`terms.section${n}_text`)}</Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050510',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, marginLeft: 12 },
  headerEyebrow: {
    fontSize: 9,
    fontFamily: 'JetBrainsMono_400Regular',
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  lastUpdate: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 10,
    fontFamily: 'JetBrainsMono_400Regular',
    letterSpacing: 1,
    marginBottom: 20,
  },
  section: { marginBottom: 18, paddingBottom: 18 },
  sectionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 8,
  },
  sectionNum: {
    color: '#00E5FF',
    fontSize: 16,
    fontFamily: 'Fraunces_400Regular_Italic',
  },
  sectionTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
  },
  paragraph: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 13,
    lineHeight: 21,
    paddingLeft: 32,
  },
});
