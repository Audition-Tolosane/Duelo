import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Language, LANGUAGE_NAMES, getLanguage, setLanguage, t } from '../utils/i18n';

export default function LanguageSettings() {
  const router = useRouter();
  const [selected, setSelected] = useState<Language>(getLanguage());

  const handleSelect = (lang: Language) => {
    setSelected(lang);
    setLanguage(lang);
  };

  const languages = Object.entries(LANGUAGE_NAMES) as [Language, string][];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow}>◆ DUELO</Text>
          <Text style={styles.headerTitle}>{t('language.title')}</Text>
        </View>
      </View>

      {/* Note about questions */}
      <View style={styles.noteContainer}>
        <Ionicons name="information-circle-outline" size={18} color="rgba(255,255,255,0.5)" />
        <Text style={styles.noteText}>{t('language.note')}</Text>
      </View>

      <ScrollView style={styles.list}>
        {languages.map(([code, name]) => {
          const active = selected === code;
          return (
            <TouchableOpacity
              key={code}
              style={[styles.langRow, active && styles.langRowActive]}
              onPress={() => handleSelect(code)}
            >
              <Text style={[styles.langText, active && styles.langTextActive]}>{name}</Text>
              {active && (
                <LinearGradient
                  colors={['#00E5FF', '#B366FF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.checkCircle}
                >
                  <MaterialCommunityIcons name="check-bold" size={14} color="#000" />
                </LinearGradient>
              )}
            </TouchableOpacity>
          );
        })}
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
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  noteText: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 13,
    flex: 1,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
  },
  langRowActive: {
    backgroundColor: 'rgba(0,229,255,0.07)',
    borderWidth: 2,
    borderColor: '#00E5FF',
  },
  langText: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  langTextActive: {
    color: '#fff',
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
