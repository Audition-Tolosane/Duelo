import React from 'react';
import { View, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

/**
 * GlassIconFrame - Glassmorphism frame for theme icons
 * Supports both URL images and emoji fallback
 * Features: frosted glass background, neon glow ring, progress ring overlay
 */

type GlassIconFrameProps = {
  iconUrl?: string;
  emoji?: string;
  size?: number;
  pillarColor: string;
  progress?: number;
  showRing?: boolean;
  locked?: boolean;
};

export const GlassIconFrame = ({
  iconUrl,
  emoji,
  size = 72,
  pillarColor,
  progress = 0,
  showRing = true,
  locked = false,
}: GlassIconFrameProps) => {
  const outerSize = size + 10;
  const ringRadius = (outerSize - 6) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));

  return (
    <View style={[gs.wrap, { width: outerSize, height: outerSize }]}>
      {/* Progress Ring (outer) */}
      {showRing && !locked && (
        <Svg width={outerSize} height={outerSize} style={gs.ringSvg}>
          {/* Track */}
          <Circle
            cx={outerSize / 2} cy={outerSize / 2} r={ringRadius}
            stroke={pillarColor + '18'} strokeWidth={3} fill="none"
          />
          {/* Progress */}
          <Circle
            cx={outerSize / 2} cy={outerSize / 2} r={ringRadius}
            stroke={pillarColor} strokeWidth={3} fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${outerSize / 2}, ${outerSize / 2}`}
          />
        </Svg>
      )}

      {/* Glassmorphism Circle */}
      <View style={[gs.glassCircle, {
        width: size,
        height: size,
        borderRadius: size / 2,
        borderColor: locked ? '#222' : pillarColor + '35',
        backgroundColor: locked ? 'rgba(10,10,10,0.9)' : 'rgba(20,20,30,0.7)',
      }]}>
        {/* Inner glow */}
        {!locked && (
          <View style={[gs.innerGlow, {
            width: size - 8,
            height: size - 8,
            borderRadius: (size - 8) / 2,
            backgroundColor: pillarColor + '08',
          }]} />
        )}

        {/* Icon: Image or Emoji */}
        {iconUrl ? (
          <Image
            source={{ uri: iconUrl }}
            style={[gs.iconImage, {
              width: size * 0.72,
              height: size * 0.72,
              borderRadius: (size * 0.72) / 2,
              opacity: locked ? 0.25 : 1,
            }]}
            resizeMode="contain"
          />
        ) : emoji ? (
          <Text style={[gs.emoji, {
            fontSize: size * 0.42,
            opacity: locked ? 0.25 : 1,
          }]}>
            {emoji}
          </Text>
        ) : null}

        {/* Glass overlay sheen */}
        {!locked && (
          <View style={[gs.sheen, {
            width: size * 0.6,
            height: size * 0.3,
            borderRadius: size * 0.15,
          }]} />
        )}
      </View>
    </View>
  );
};

/**
 * TopicCard - Individual theme topic card (e.g., Breaking Bad)
 * Shows icon in GlassIconFrame with name and category
 */
type TopicCardProps = {
  name: string;
  iconUrl?: string;
  emoji?: string;
  pillarColor: string;
  categoryName?: string;
  onPress?: () => void;
  progress?: number;
  level?: number;
};

export const TopicCard = ({
  name,
  iconUrl,
  emoji,
  pillarColor,
  categoryName,
  progress = 0,
  level = 0,
}: TopicCardProps) => {
  return (
    <View style={ts.card}>
      <View style={[ts.cardInner, { borderColor: pillarColor + '25' }]}>
        {/* Glass glow background */}
        <View style={[ts.cardGlow, {
          backgroundColor: pillarColor + '06',
          shadowColor: pillarColor,
        }]} />

        <GlassIconFrame
          iconUrl={iconUrl}
          emoji={emoji}
          size={68}
          pillarColor={pillarColor}
          progress={progress}
          showRing={true}
        />

        <Text style={ts.name} numberOfLines={2}>{name}</Text>

        {categoryName ? (
          <Text style={[ts.category, { color: pillarColor + 'AA' }]} numberOfLines={1}>
            {categoryName}
          </Text>
        ) : null}

        {level > 0 && (
          <View style={[ts.levelBadge, { backgroundColor: pillarColor + '20', borderColor: pillarColor + '40' }]}>
            <Text style={[ts.levelText, { color: pillarColor }]}>Niv. {level}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const gs = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringSvg: {
    position: 'absolute',
  },
  glassCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  innerGlow: {
    position: 'absolute',
  },
  iconImage: {
    zIndex: 2,
  },
  emoji: {
    zIndex: 2,
  },
  sheen: {
    position: 'absolute',
    top: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    zIndex: 3,
  },
});

const ts = StyleSheet.create({
  card: {
    width: 130,
  },
  cardInner: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    minHeight: 160,
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    height: 80,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  name: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },
  category: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: 0.5,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
  },
  levelText: {
    fontSize: 9,
    fontWeight: '800',
  },
});
