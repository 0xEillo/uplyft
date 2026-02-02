import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useThemedColors } from '@/hooks/useThemedColors'

interface StartWorkoutCardProps {
  onPress?: () => void
}

export function StartWorkoutCard({ onPress }: StartWorkoutCardProps) {
  const colors = useThemedColors()
  const router = useRouter()

  const handlePress = () => {
    if (onPress) {
      onPress()
    } else {
      router.push('/(tabs)/create-post')
    }
  }

  const styles = createStyles(colors)

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={[colors.brandPrimary, colors.brandPrimary + 'DD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <Text style={styles.appName}>Rep AI</Text>
            <Text style={styles.subtitle}>Start tracking your workout</Text>
          </View>

          <View style={styles.iconContainer}>
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.addButton}>
          <Ionicons name="barbell-outline" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Exercise</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    gradient: {
      padding: 20,
    },
    content: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    textContainer: {
      flex: 1,
    },
    appName: {
      fontSize: 24,
      fontWeight: '800',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.85)',
      fontWeight: '500',
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      gap: 8,
    },
    addButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  })
