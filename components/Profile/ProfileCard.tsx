import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'

export const PROFILE_CARD_HEIGHT = 140

export const useProfileCardDimensions = () => {
  const { width } = useWindowDimensions()
  const cardWidth = Math.round(width * 0.42)
  return { cardWidth, cardHeight: PROFILE_CARD_HEIGHT }
}

interface ProfileCardProps {
  label: string
  title: string
  subtext?: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  width: number
  height: number
  tintColor?: string
  titleColor?: string
}

export function ProfileCard({
  label,
  title,
  subtext,
  icon,
  onPress,
  width,
  height,
  tintColor,
  titleColor,
}: ProfileCardProps) {
  const colors = useThemedColors()

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
          backgroundColor: tintColor ?? colors.surfaceCard,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.bg },
          ]}
        >
          <Ionicons name={icon} size={22} color={colors.textSecondary} />
        </View>
      </View>

      <View style={styles.cardContent}>
        <Text
          style={[styles.cardLabel, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <View style={styles.titleContainer}>
          <Text
            style={[
              styles.cardTitle,
              { color: titleColor ?? colors.textPrimary },
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        </View>
        {subtext ? (
          <Text
            style={[styles.cardSubtext, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtext}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    marginTop: 8,
    flex: 1,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  titleContainer: {
    minHeight: 48,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  cardSubtext: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
})

