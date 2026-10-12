import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Rect, Ellipse, Polygon, Line, Polyline, G } from 'react-native-svg';
import Icon from './Icon';
import { THEME_ICONS, SvgNode, ThemeIconName } from '../../theme/themeIcons.generated';
import { resolveThemeIcon, ThemeIconSource } from '../../theme/themeIconMap';
import { COLOR, RADII } from '../../theme/tokens';

const ELEMENTS: Record<string, React.ComponentType<any>> = {
  path: Path, circle: Circle, rect: Rect, ellipse: Ellipse, polygon: Polygon, line: Line, polyline: Polyline, g: G,
};

export function renderNode(n: SvgNode, key: string): React.ReactNode {
  const Cmp = ELEMENTS[n.t];
  if (!Cmp) return null;
  return <Cmp key={key} {...n.p}>{n.c?.map((c, i) => renderNode(c, `${key}.${i}`))}</Cmp>;
}

/** Illustration SKILKI brute (sans plaque). Couleurs fixes : jamais teintée par le code. */
export function ThemeIllustration({ name, size }: { name: ThemeIconName; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      {THEME_ICONS[name].map((n, i) => renderNode(n, String(i)))}
    </Svg>
  );
}

type Props = ThemeIconSource & {
  /** Force une illustration précise. */
  name?: ThemeIconName;
  /** Taille de la plaque (28 → 112). Sous 28 px, utiliser une icône UI. */
  size?: number;
  /** false = sans plaque (fond crème déjà présent). */
  plate?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Icône de thème : illustration SKILKI centrée sur une plaque crème (squircle) + liseré pétrole léger.
export default function ThemeIcon({ name, themeId, themeName, cluster, superCategory, size = 56, plate = true, style }: Props) {
  const resolved = name ? { kind: 'illustration' as const, name } : resolveThemeIcon({ themeId, themeName, cluster, superCategory });
  const inner = Math.round(size * 0.78);
  const radius = Math.max(8, Math.round(size * (RADII.plate / 56)));
  const content = resolved.kind === 'illustration'
    ? <ThemeIllustration name={resolved.name} size={plate ? inner : size} />
    : <Icon name={resolved.name} size={Math.round(size * 0.46)} color={COLOR.surface.card} strokeWidth={2.2} />;
  if (!plate) return <View style={style}>{content}</View>;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.plate, { width: size, height: size, borderRadius: radius }, style]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    backgroundColor: COLOR.plate.fill,
    borderWidth: 1,
    borderColor: COLOR.plate.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
