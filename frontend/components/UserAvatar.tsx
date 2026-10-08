import React from 'react';
import { View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Txt from './ui/Txt';
import { COLOR, PALETTE } from '../theme/tokens';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

function getAvatarColor(seed: string): string {
  // Teintes de repli SKILKI validées au pilote : pétroles et tons sourds, jamais jaune (mon camp /
  // action) ni corail (adversaire) — un avatar ne doit pas brouiller les rôles. Les 5 tons sourds
  // n'existent pas comme rôles du design system : ils restent propres aux avatars.
  const colors = COLOR.avatar;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Cadres cosmétiques (boutique / récompenses) : moment de prestige, dégradé entre deux teintes de la
// MÊME famille de la palette SKILKI (jamais cyan→violet). Diamant = rare (violet), seul usage du violet.
const FRAME_GRADIENTS: Record<string, [string, string, string]> = {
  gold_frame:     [PALETTE.gold, PALETTE.yellow, PALETTE.gold],
  fire_frame:     [PALETTE.coral, PALETTE.gold, PALETTE.coral],
  diamond_frame:  [PALETTE.violet, PALETTE.cream, PALETTE.violet],
  champion_frame: [PALETTE.yellow, PALETTE.gold, PALETTE.yellow],
};

type Props = {
  avatarUrl?: string | null;
  avatarSeed?: string;
  pseudo?: string;
  size?: number;
  borderColor?: string;
  borderWidth?: number;
  frame?: string | null;
};

export default function UserAvatar({
  avatarUrl,
  avatarSeed = '',
  pseudo = '?',
  size = 40,
  borderColor,
  borderWidth = 0,
  frame,
}: Props) {
  const hasImage = !!avatarUrl;
  const fullUrl = hasImage ? `${API_URL}/static/${avatarUrl}` : null;
  const bgColor = getAvatarColor(avatarSeed || pseudo);
  const initial = pseudo?.[0]?.toUpperCase() || '?';
  const fontSize = size * 0.45;
  const radius = size / 2;

  const frameGrad = frame ? FRAME_GRADIENTS[frame] : null;
  const framePad = frameGrad ? 3 : 0;
  const outerSize = size + framePad * 2;

  const inner = (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: hasImage ? COLOR.surface.card : bgColor,
          justifyContent: 'center',
          alignItems: 'center',
        },
        !frameGrad && borderColor ? { borderWidth: borderWidth || 2, borderColor } : null,
      ]}
    >
      {fullUrl ? (
        <Image
          source={{ uri: fullUrl }}
          style={{ width: size, height: size, borderRadius: radius }}
          resizeMode="cover"
        />
      ) : (
        // Initiale : graisse et police du système (h1), seule la taille suit le diamètre de l'avatar
        <Txt variant="h1" color={COLOR.text.primary} style={{ fontSize, lineHeight: fontSize * 1.15 }}>
          {initial}
        </Txt>
      )}
    </View>
  );

  if (!frameGrad) return inner;

  return (
    <LinearGradient
      colors={frameGrad}
      style={{
        width: outerSize,
        height: outerSize,
        borderRadius: outerSize / 2,
        padding: framePad,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {inner}
    </LinearGradient>
  );
}
