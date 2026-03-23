import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../utils/i18n';

export default function Terms() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('terms.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdate}>{t('terms.last_update')}</Text>

        <Text style={styles.sectionTitle}>{t('terms.section1_title')}</Text>
        <Text style={styles.paragraph}>
          {t('terms.section1_text')}
        </Text>

        <Text style={styles.sectionTitle}>{t('terms.section2_title')}</Text>
        <Text style={styles.paragraph}>
          {t('terms.section2_text')}
        </Text>

        <Text style={styles.sectionTitle}>{t('terms.section3_title')}</Text>
        <Text style={styles.paragraph}>
          {t('terms.section3_text')}
        </Text>

        <Text style={styles.sectionTitle}>{t('terms.section4_title')}</Text>
        <Text style={styles.paragraph}>
          {t('terms.section4_text')}
        </Text>

        <Text style={styles.sectionTitle}>{t('terms.section5_title')}</Text>
        <Text style={styles.paragraph}>
          {t('terms.section5_text')}
        </Text>

        <Text style={styles.sectionTitle}>{t('terms.section6_title')}</Text>
        <Text style={styles.paragraph}>
          {t('terms.section6_text')}
        </Text>

        <Text style={styles.sectionTitle}>{t('terms.section7_title')}</Text>
        <Text style={styles.paragraph}>
          {t('terms.section7_text')}
        </Text>

        <Text style={styles.sectionTitle}>{t('terms.section8_title')}</Text>
        <Text style={styles.paragraph}>
          {t('terms.section8_text')}
        </Text>

        <Text style={styles.sectionTitle}>{t('terms.section9_title')}</Text>
        <Text style={styles.paragraph}>
          {t('terms.section9_text')}
        </Text>

        <Text style={styles.sectionTitle}>{t('terms.section10_title')}</Text>
        <Text style={styles.paragraph}>
          {t('terms.section10_text')}
        </Text>

        <Text style={styles.sectionTitle}>{t('terms.section11_title')}</Text>
        <Text style={styles.paragraph}>
          {t('terms.section11_text')}
        </Text>

        <View style={{ height: 40 }} />
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  lastUpdate: {
    color: '#666',
    fontSize: 12,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 22,
  },
});
