// ============================================================
// Duelo — Neon admin UI kit (couche présentation)
// À copier dans : frontend/components/admin/AdminUI.tsx
//
// Composants purement visuels — AUCUNE logique métier.
// Tu gardes tout admin.tsx (auth, CSV, fetch, états) tel quel,
// et tu remplaces le JSX de rendu par ces briques.
// ============================================================
import React from 'react';
import {
  View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, ScrollView,
  useWindowDimensions, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '../../theme/fonts';
import { COLORS } from '../../theme/tokens';
import { NEON, glow, gradients, NRADIUS } from '../../theme/adminTheme';

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

// ── Breakpoint desktop ──
export const useWide = () => useWindowDimensions().width >= 900;

// ────────────────────────────────────────────────────────────
// SHELL : sidebar verticale (desktop) OU tab-bar (mobile)
// ────────────────────────────────────────────────────────────
export function AdminShell({
  tabs, tabIcons, active, onTab, badges = {}, children, onLogout,
}: {
  tabs: string[];
  tabIcons: Record<string, string>;
  active: number;
  onTab: (i: number) => void;
  badges?: Record<string, number>;
  children: React.ReactNode;
  onLogout?: () => void;
}) {
  const wide = useWide();

  if (wide) {
    return (
      <View style={s.shellRow}>
        {/* ── Sidebar ── */}
        <View style={s.sidebar}>
          <Brand />
          <Text style={s.navLabel}>GESTION</Text>
          <View style={{ gap: 4 }}>
            {tabs.map((t, i) => (
              <NavItem key={t} label={t} icon={tabIcons[t] as Icon}
                active={i === active} badge={badges[t]} onPress={() => onTab(i)} />
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onLogout} style={s.userChip}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.userAv}>
              <Text style={s.userAvTxt}>A</Text>
            </LinearGradient>
            <View>
              <Text style={s.userName}>Admin</Text>
              <Text style={s.userRole}>Accès interne</Text>
            </View>
            <MaterialCommunityIcons name="logout" size={16} color={NEON.txt3} style={{ marginLeft: 'auto' }} />
          </Pressable>
        </View>
        {/* ── Contenu ── */}
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }

  // Mobile : tab-bar horizontale (comportement actuel conservé)
  return (
    <View style={{ flex: 1, backgroundColor: NEON.bg }}>
      <View style={s.tabBar}>
        {tabs.map((t, i) => (
          <Pressable key={t} onPress={() => onTab(i)} style={[s.tabBtn, i === active && s.tabBtnOn]}>
            <MaterialCommunityIcons name={tabIcons[t] as Icon} size={20}
              color={i === active ? COLORS.cyan : NEON.txt3} />
            <Text style={[s.tabTxt, i === active && { color: COLORS.white }]}>{t}</Text>
            {!!badges[t] && <View style={s.badge}><Text style={s.badgeTxt}>{badges[t]}</Text></View>}
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function NavItem({ label, icon, active, badge, onPress }: {
  label: string; icon: Icon; active: boolean; badge?: number; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.navItem, active && s.navItemOn]}>
      {active && <View style={s.navAccent} />}
      <MaterialCommunityIcons name={icon} size={19} color={active ? COLORS.white : NEON.txt2} />
      <Text style={[s.navTxt, active && { color: COLORS.white }]}>{label}</Text>
      {!!badge && <View style={s.badge}><Text style={s.badgeTxt}>{badge}</Text></View>}
    </Pressable>
  );
}

function Brand() {
  return (
    <View style={s.brand}>
      <View style={s.brandMark}>
        <MaterialCommunityIcons name="shield-outline" size={30} color={COLORS.violet} />
        <MaterialCommunityIcons name="sword" size={18} color={COLORS.cyan}
          style={{ position: 'absolute', transform: [{ rotate: '0deg' }] }} />
      </View>
      <View>
        <Text style={s.brandName}>Duelo</Text>
        <Text style={s.brandTag}>CONSOLE ADMIN</Text>
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// TOPBAR (titre d'écran + sous-titre)
// ────────────────────────────────────────────────────────────
export function TopBar({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={s.topbar}>
      <View style={{ flex: 1 }}>
        <Text style={s.eyebrow}>◆ INTERNE</Text>
        <Text style={s.h1}>{title}</Text>
        {!!subtitle && <Text style={s.sub}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// CARD : barre gradient en haut + bordure néon
// ────────────────────────────────────────────────────────────
export function AdminCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[s.card, style]}>
      <LinearGradient colors={gradients.topAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cardTop} />
      {children}
    </View>
  );
}

export function SectionHead({ icon, title, desc, right }: {
  icon: Icon; title: string; desc?: string; right?: React.ReactNode;
}) {
  return (
    <View style={s.sectionHead}>
      <View style={s.shIcon}><MaterialCommunityIcons name={icon} size={20} color={COLORS.violet} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.shTitle}>{title}</Text>
        {!!desc && <Text style={s.shDesc}>{desc}</Text>}
      </View>
      {right}
    </View>
  );
}

// ── Bouton néon ──
export function NeonButton({ label, icon, onPress, variant = 'primary', block, style }: {
  label: string; icon?: Icon; onPress?: () => void;
  variant?: 'primary' | 'accent' | 'warn' | 'danger' | 'ghost'; block?: boolean; style?: ViewStyle;
}) {
  const V: Record<string, { bg: string[] | null; fg: string; solid?: string }> = {
    primary: { bg: [...gradients.brand], fg: '#04040C' },
    accent:  { bg: [COLORS.mint, '#00A844'], fg: '#04120B' },
    warn:    { bg: [COLORS.fire, '#E55A2B'], fg: '#1A0A03' },
    danger:  { bg: null, fg: '#fff', solid: COLORS.red },
    ghost:   { bg: null, fg: NEON.txt1, solid: NEON.panel },
  };
  const v = V[variant];
  const inner = (
    <>
      {icon && <MaterialCommunityIcons name={icon} size={18} color={v.fg} />}
      <Text style={[s.btnTxt, { color: v.fg }]}>{label}</Text>
    </>
  );
  const glowStyle = variant === 'primary' ? glow(COLORS.cyan, 24, 0.35) : undefined;
  if (v.bg) {
    return (
      <Pressable onPress={onPress} style={[block && { width: '100%' }, style]}>
        <LinearGradient colors={v.bg as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[s.btn, glowStyle]}>{inner}</LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress}
      style={[s.btn, { backgroundColor: v.solid, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: NEON.border },
        block && { width: '100%' }, style]}>{inner}</Pressable>
  );
}

// ── Stat card ──
export function StatCard({ num, label, icon, color = COLORS.violet }: {
  num: string | number; label: string; icon?: Icon; color?: string;
}) {
  return (
    <View style={[s.stat, glow(color, 24, 0.12)]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: NRADIUS.card, borderWidth: 1, borderColor: 'rgba(0,229,255,0.12)' }]} />
      {icon && <MaterialCommunityIcons name={icon} size={20} color={color} style={{ marginBottom: 8 }} />}
      <Text style={[s.statNum, { color }]}>{num}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

// ── Barre de stat (classement thèmes) ──
export function BarRow({ rank, name, count, sub, pct, top }: {
  rank: number; name: string; count: string; sub?: string; pct: number; top?: boolean;
}) {
  return (
    <View style={s.barRow}>
      <View style={[s.barRank, top && glow(COLORS.violet, 16, 0.5)]}>
        {top
          ? <LinearGradient colors={gradients.brand} style={StyleSheet.absoluteFill as any} />
          : null}
        <Text style={[s.barRankTxt, top && { color: '#04040C' }]}>{rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.barTop}>
          <Text style={s.barName}>{name}</Text>
          <Text style={s.barCount}>{count}</Text>
        </View>
        <View style={s.barTrack}>
          <LinearGradient colors={gradients.bar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[s.barFill, { width: `${Math.max(4, pct)}%` }, glow(COLORS.cyan, 12, 0.5)]} />
        </View>
        {!!sub && <Text style={s.barSub}>{sub}</Text>}
      </View>
    </View>
  );
}

// ── Report card ──
export function ReportCard({ status, date, question, meta, desc, actions }: {
  status: 'pending' | 'reviewed' | 'resolved'; date: string; question: string;
  meta: { icon: Icon; label: string; value: string }[]; desc?: string; actions?: React.ReactNode;
}) {
  const S = { pending: COLORS.gold, reviewed: COLORS.cyan, resolved: COLORS.mint }[status];
  const L = { pending: 'En attente', reviewed: 'Examiné', resolved: 'Résolu' }[status];
  return (
    <AdminCard style={{ marginBottom: 14 }}>
      <View style={s.rcHead}>
        <View style={[s.rcStatus, { backgroundColor: S + '22', borderColor: S }]}>
          <Text style={[s.rcStatusTxt, { color: S }]}>{L}</Text>
        </View>
        <Text style={s.rcDate}>{date}</Text>
      </View>
      <Text style={s.rcQ}>{question}</Text>
      <View style={s.rcMeta}>
        {meta.map((m, i) => (
          <View key={i} style={s.rcMetaItem}>
            <MaterialCommunityIcons name={m.icon} size={15} color={NEON.txt2} />
            <Text style={s.rcMetaLbl}>{m.label}</Text>
            <Text style={s.rcMetaVal}>{m.value}</Text>
          </View>
        ))}
      </View>
      {!!desc && (
        <View style={s.rcDesc}><Text style={s.rcDescTxt}>« {desc} »</Text></View>
      )}
      {actions && <View style={s.rcActions}>{actions}</View>}
    </AdminCard>
  );
}

// ── Fond quadrillé néon (à poser en absolute derrière le contenu) ──
export function NeonGrid() {
  // Grille dessinée avec des bordures — léger, sans SVG.
  const lines = [];
  for (let i = 1; i < 40; i++) lines.push(i);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {lines.map(i => (
        <View key={'h' + i} style={{ position: 'absolute', left: 0, right: 0, top: i * 44, height: 1, backgroundColor: NEON.gridLine }} />
      ))}
      {lines.map(i => (
        <View key={'v' + i} style={{ position: 'absolute', top: 0, bottom: 0, left: i * 44, width: 1, backgroundColor: NEON.gridLine }} />
      ))}
    </View>
  );
}

// ────────────────────────────────────────────────────────────
const mono = FONTS.mono.regular, monoB = FONTS.mono.bold;
const dispB = FONTS.display.bold, dispS = FONTS.display.semiBold, dispR = FONTS.display.regular;

const s = StyleSheet.create({
  shellRow: { flex: 1, flexDirection: 'row', backgroundColor: NEON.bg },
  sidebar: {
    width: 256, paddingHorizontal: 16, paddingVertical: 22,
    borderRightWidth: 1, borderRightColor: NEON.border, gap: 6,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingBottom: 20 },
  brandMark: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: dispB, fontSize: 19, color: COLORS.white, letterSpacing: -0.5 },
  brandTag: { fontFamily: mono, fontSize: 9, letterSpacing: 2.5, color: COLORS.violet, marginTop: 2 },
  navLabel: { fontFamily: mono, fontSize: 9.5, letterSpacing: 2.5, color: NEON.txt3, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: NRADIUS.sm, borderWidth: 1, borderColor: 'transparent' },
  navItemOn: { backgroundColor: NEON.panelHi, borderColor: 'rgba(0,229,255,0.25)' },
  navAccent: { position: 'absolute', left: -16, top: '50%', marginTop: -11, width: 4, height: 22, borderRadius: 4, backgroundColor: COLORS.cyan },
  navTxt: { fontFamily: dispS, fontSize: 14, color: NEON.txt2 },
  badge: { marginLeft: 'auto', minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 999, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', ...glow(COLORS.red, 12, 0.6) },
  badgeTxt: { color: '#fff', fontFamily: dispB, fontSize: 11 },
  userChip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: NRADIUS.sm, borderTopWidth: 1, borderTopColor: NEON.border, marginTop: 8 },
  userAv: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  userAvTxt: { fontFamily: dispB, fontSize: 14, color: '#04040C' },
  userName: { fontFamily: dispB, fontSize: 13, color: COLORS.white },
  userRole: { fontFamily: dispR, fontSize: 11, color: NEON.txt3 },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: NEON.border, backgroundColor: 'rgba(255,255,255,0.02)' },
  tabBtn: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 12 },
  tabBtnOn: { borderBottomWidth: 2, borderBottomColor: COLORS.cyan },
  tabTxt: { fontFamily: dispS, fontSize: 10, color: NEON.txt3 },

  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: NEON.border },
  eyebrow: { fontFamily: mono, fontSize: 10, letterSpacing: 2.5, color: COLORS.violet },
  h1: { fontFamily: dispB, fontSize: 20, color: COLORS.white, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
  sub: { fontFamily: dispR, fontSize: 13.5, color: NEON.txt2, marginTop: 4 },

  card: { backgroundColor: NEON.panel, borderWidth: 1, borderColor: NEON.border, borderRadius: NRADIUS.card, padding: 22, marginBottom: 20, overflow: 'hidden', ...glow(COLORS.cyan, 40, 0.05) },
  cardTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  shIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(179,102,255,0.12)' },
  shTitle: { fontFamily: dispB, fontSize: 15, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 0.5 },
  shDesc: { fontFamily: dispR, fontSize: 12.5, color: NEON.txt2, marginTop: 2 },

  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: NRADIUS.sm },
  btnTxt: { fontFamily: dispB, fontSize: 14 },

  stat: { flex: 1, borderRadius: NRADIUS.card, padding: 18, backgroundColor: NEON.panelSoft, overflow: 'hidden' },
  statNum: { fontFamily: dispB, fontSize: 30, letterSpacing: -1 },
  statLbl: { fontFamily: dispS, fontSize: 11, color: NEON.txt2, marginTop: 2 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: NEON.border },
  barRank: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(179,102,255,0.12)', overflow: 'hidden' },
  barRankTxt: { fontFamily: monoB, fontSize: 12, color: COLORS.violet },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 },
  barName: { fontFamily: dispS, fontSize: 14, color: COLORS.white },
  barCount: { fontFamily: dispB, fontSize: 15, color: COLORS.mint },
  barTrack: { height: 7, borderRadius: 999, backgroundColor: NEON.panelHi, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  barSub: { fontFamily: mono, fontSize: 10.5, color: NEON.txt3, marginTop: 5 },

  rcHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  rcStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  rcStatusTxt: { fontFamily: monoB, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase' },
  rcDate: { fontFamily: mono, fontSize: 11, color: NEON.txt3 },
  rcQ: { fontFamily: dispS, fontSize: 15, color: COLORS.white, lineHeight: 22, marginBottom: 12 },
  rcMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginBottom: 10 },
  rcMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rcMetaLbl: { fontFamily: dispR, fontSize: 12.5, color: NEON.txt2 },
  rcMetaVal: { fontFamily: dispS, fontSize: 12.5, color: COLORS.white },
  rcDesc: { backgroundColor: NEON.panelSoft, borderLeftWidth: 3, borderLeftColor: COLORS.gold, borderRadius: 8, padding: 10, marginBottom: 12 },
  rcDescTxt: { fontFamily: dispR, fontSize: 13, color: NEON.txt1, fontStyle: 'italic' },
  rcActions: { flexDirection: 'row', gap: 10 },
});
