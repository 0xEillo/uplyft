import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native'

export const PROFILE_CARD_HEIGHT = 160

export const useProfileCardDimensions = () => {
  const { width } = useWindowDimensions()
  const cardWidth = Math.round(width * 0.44)
  return { cardWidth, cardHeight: PROFILE_CARD_HEIGHT }
}

interface ProfileCardProps {
  title: string
  label?: string
  subtext?: string
  icon?: keyof typeof Ionicons.glyphMap
  imageUri?: string | null
  onPress: () => void
  width: number
  height: number
  tintColor?: string | null
  titleColor?: string
}

export function ProfileCard({
  label,
  title,
  subtext,
  icon,
  imageUri,
  onPress,
  width,
  height,
  tintColor,
  titleColor,
}: ProfileCardProps) {
  const colors = useThemedColors()
  const hasImage = !!imageUri
  
  // Default tint if none provided, to match the routine page logic
  const defaultTint = '#94A3B8'
  const activeTint = tintColor || defaultTint

  return (
    <TouchableOpacity
      onPress={() => {
        haptic('light')
        onPress()
      }}
      activeOpacity={0.9}
      style={[
        styles.card,
        {
          width,
          height,
          backgroundColor: colors.surfaceCard,
          borderWidth: hasImage ? 0 : 1,
          borderColor: colors.border,
        },
      ]}
    >
      {hasImage ? (
        <>
          <Image
            source={{ uri: imageUri }}
            style={[StyleSheet.absoluteFill, styles.cardImage]}
          />
          {/* Base darkening gradient for text readability */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
            style={StyleSheet.absoluteFill}
          />
          {/* Tint overlay matching the routine page (25% opacity) */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: activeTint, opacity: 0.25 },
            ]}
          />
        </>
      ) : (
        /* Gradient background matching the routine page (no image case) */
        <LinearGradient
          colors={[`${activeTint}60`, `${activeTint}30`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={styles.contentContainer}>
        {icon && !hasImage && (
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: 'rgba(255,255,255,0.15)' },
            ]}
          >
            <Ionicons name={icon} size={20} color={colors.textPrimary} />
          </View>
        )}

        <View style={styles.textContainer}>
          {label ? (
            <Text
              style={[
                styles.cardLabel,
                { color: (hasImage || tintColor) ? '#fff' : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ) : null}

          <Text
            style={[
              styles.cardTitle,
              { color: titleColor ?? ((hasImage || tintColor) ? '#fff' : colors.textPrimary) },
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>

          {subtext ? (
            <Text
              style={[
                styles.cardSubtext,
                { color: (hasImage || tintColor) ? 'rgba(255,255,255,0.8)' : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {subtext}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardImage: {
    resizeMode: 'cover',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-end',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 16,
    left: 16,
  },
  textContainer: {
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    opacity: 0.8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: -0.5,
  },
  cardSubtext: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    opacity: 0.9,
  },
})
