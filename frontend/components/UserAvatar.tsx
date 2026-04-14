import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

function getAvatarColor(seed: string): string {
  const colors = ['#8A2BE2', '#FF3B30', '#00C97A', '#FF6B35', '#00BFFF', '#FFD700', '#FF69B4', '#7B68EE'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Frame definitions: gradient colors for each cosmetic frame
const FRAME_GRADIENTS: Record<string, [string, string, string]> = {
  gold_frame:     ['#FFD700', '#FF9F0A', '#FFD700'],
  fire_frame:     ['#FF6B35', '#FF0000', '#FF6B35'],
  diamond_frame:  ['#00D4FF', '#8A2BE2', '#00D4FF'],
  champion_frame: ['#E8D5FF', '#8A2BE2', '#E8D5FF'],
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
          backgroundColor: hasImage ? '#1A1A2E' : bgColor,
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
        <Text style={{ color: '#FFF', fontSize, fontWeight: '900' }}>
          {initial}
        </Text>
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
