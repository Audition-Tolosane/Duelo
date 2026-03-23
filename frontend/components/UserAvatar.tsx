import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

function getAvatarColor(seed: string): string {
  const colors = ['#8A2BE2', '#FF3B30', '#00C97A', '#FF6B35', '#00BFFF', '#FFD700', '#FF69B4', '#7B68EE'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

type Props = {
  avatarUrl?: string | null;
  avatarSeed?: string;
  pseudo?: string;
  size?: number;
  borderColor?: string;
  borderWidth?: number;
};

export default function UserAvatar({
  avatarUrl,
  avatarSeed = '',
  pseudo = '?',
  size = 40,
  borderColor,
  borderWidth = 0,
}: Props) {
  const hasImage = !!avatarUrl;
  const fullUrl = hasImage ? `${API_URL}/static/${avatarUrl}` : null;
  const bgColor = getAvatarColor(avatarSeed || pseudo);
  const initial = pseudo?.[0]?.toUpperCase() || '?';
  const fontSize = size * 0.45;
  const radius = size / 2;

  return (
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
        borderColor ? { borderWidth: borderWidth || 2, borderColor } : null,
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
}
