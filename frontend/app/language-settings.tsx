import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('language.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Note about questions */}
      <View style={styles.noteContainer}>
        <Ionicons name="information-circle-outline" size={18} color="#888" />
        <Text style={styles.noteText}>{t('language.note')}</Text>
      </View>

      <ScrollView style={styles.list}>
        {languages.map(([code, name]) => (
          <TouchableOpacity
            key={code}
            style={[styles.langRow, selected === code && styles.langRowActive]}
            onPress={() => handleSelect(code)}
          >
            <Text style={[styles.langText, selected === code && styles.langTextActive]}>{name}</Text>
            {selected === code && (
              <Ionicons name="checkmark-circle" size={22} color="#6C63FF" />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
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
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  noteText: {
    color: '#888',
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
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  langRowActive: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  langText: {
    color: '#ccc',
    fontSize: 16,
  },
  langTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
