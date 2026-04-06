import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SwipeBackPage from '../components/SwipeBackPage';
import DueloHeader from '../components/DueloHeader';
import CosmicBackground from '../components/CosmicBackground';
import { GLASS } from '../theme/glassTheme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShopItem {
  id: string;
  title: string;
  description: string;
  price: string;
  icon: string;
  color: string;
  gradient: [string, string];
  badge?: string;
}

// ── Données produits ──────────────────────────────────────────────────────────

const COIN_PACKS: ShopItem[] = [
  {
    id: 'coins_small',
    title: '500 Pièces',
    description: 'Idéal pour débuter',
    price: '0,99 €',
    icon: 'currency-usd',
    color: '#FFB800',
    gradient: ['#FFB800', '#FF8C00'],
  },
  {
    id: 'coins_medium',
    title: '1 200 Pièces',
    description: '+20% bonus',
    price: '1,99 €',
    icon: 'cash-multiple',
    color: '#FFB800',
    gradient: ['#FFD700', '#FFB800'],
    badge: 'POPULAIRE',
  },
  {
    id: 'coins_large',
    title: '3 000 Pièces',
    description: '+50% bonus',
    price: '3,99 €',
    icon: 'treasure-chest',
    color: '#FFB800',
    gradient: ['#FFA500', '#FF6B00'],
    badge: 'MEILLEURE OFFRE',
  },
];

const BOOSTS: ShopItem[] = [
  {
    id: 'boost_xp_2x',
    title: 'Boost XP ×2',
    description: 'Double ton XP pendant 24h',
    price: '1,99 €',
    icon: 'lightning-bolt',
    color: '#00E5FF',
    gradient: ['#00E5FF', '#0077FF'],
  },
  {
    id: 'boost_shield',
    title: 'Bouclier de Série',
    description: 'Protège ta série 1 jour',
    price: '0,99 €',
    icon: 'shield-star',
    color: '#BF5FFF',
    gradient: ['#BF5FFF', '#7B22E2'],
  },
  {
    id: 'boost_reroll',
    title: 'Pack Rerolls ×5',
    description: 'Renouvelle 5 missions',
    price: '0,99 €',
    icon: 'refresh',
    color: '#00FF9D',
    gradient: ['#00FF9D', '#00CC7A'],
  },
];

const PREMIUM: ShopItem[] = [
  {
    id: 'premium_monthly',
    title: 'Duelo Premium',
    description: 'XP ×1.5, pas de pubs, missions bonus',
    price: '4,99 € / mois',
    icon: 'crown',
    color: '#FFD700',
    gradient: ['#FFD700', '#FFB800'],
    badge: 'LE PLUS AVANTAGEUX',
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionTitle}>
      <MaterialCommunityIcons name={icon as any} size={16} color="#FFB800" />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

function ShopCard({ item, onPress }: { item: ShopItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      <LinearGradient
        colors={[item.gradient[0] + '22', item.gradient[1] + '11']}
        style={styles.cardGradient}
      >
        {item.badge && (
          <View style={[styles.badge, { backgroundColor: item.color + '33', borderColor: item.color + '66' }]}>
            <Text style={[styles.badgeText, { color: item.color }]}>{item.badge}</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <LinearGradient colors={item.gradient} style={[styles.iconBox, { shadowColor: item.gradient[0] }]}>
            <MaterialCommunityIcons name={item.icon as any} size={26} color="#FFF" />
          </LinearGradient>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.description}</Text>
          </View>
          <View style={[styles.priceBox, { borderColor: item.color + '55', backgroundColor: item.color + '15' }]}>
            <Text style={[styles.priceText, { color: item.color }]}>{item.price}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handlePurchase = (item: ShopItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Achat in-app',
      `Les achats in-app seront disponibles prochainement.\n\n(${item.title} — ${item.price})`,
      [{ text: 'OK' }],
    );
  };

  return (
    <SwipeBackPage>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <CosmicBackground />
        <DueloHeader />

        {/* Sub-header */}
        <View style={styles.subHeader}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="chevron-left" size={26} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.subHeaderCenter}>
            <MaterialCommunityIcons name="store" size={18} color="#FFB800" />
            <Text style={styles.subHeaderTitle}>Magasin</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <LinearGradient colors={['rgba(255,184,0,0.15)', 'transparent']} style={styles.hero}>
            <MaterialCommunityIcons name="store-outline" size={48} color="#FFB800" />
            <Text style={styles.heroTitle}>Boutique Duelo</Text>
            <Text style={styles.heroSub}>Booste ton expérience de jeu</Text>
          </LinearGradient>

          {/* Coins */}
          <SectionTitle title="Pièces" icon="currency-usd-circle" />
          {COIN_PACKS.map(item => (
            <ShopCard key={item.id} item={item} onPress={() => handlePurchase(item)} />
          ))}

          {/* Boosts */}
          <SectionTitle title="Boosts & Power-ups" icon="lightning-bolt-circle" />
          {BOOSTS.map(item => (
            <ShopCard key={item.id} item={item} onPress={() => handlePurchase(item)} />
          ))}

          {/* Premium */}
          <SectionTitle title="Premium" icon="crown-circle" />
          {PREMIUM.map(item => (
            <ShopCard key={item.id} item={item} onPress={() => handlePurchase(item)} />
          ))}

          <Text style={styles.legal}>
            Les achats sont traités par l'App Store / Google Play.{'\n'}
            Abonnements résiliables à tout moment.
          </Text>
        </ScrollView>
      </View>
    </SwipeBackPage>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },

  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  subHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },

  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    borderRadius: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.2)',
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFB800', marginTop: 10 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },

  sectionTitle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 20, marginBottom: 10,
  },
  sectionTitleText: { fontSize: 14, fontWeight: '800', color: '#FFB800', letterSpacing: 1, textTransform: 'uppercase' },

  card: {
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardGradient: { padding: 14 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 8,
  },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 10,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  cardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  priceBox: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'center',
  },
  priceText: { fontSize: 13, fontWeight: '900' },

  legal: {
    fontSize: 10, color: 'rgba(255,255,255,0.3)',
    textAlign: 'center', marginTop: 24, lineHeight: 16,
  },
});
