import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Tabs, useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'

import { HapticTab } from '@/components/haptic-tab'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'

const PENDING_POST_KEY = '@pending_workout_post'

function CreateButton() {
  const router = useRouter()
  const colors = useThemedColors()
  const [isCreatingPost, setIsCreatingPost] = useState(false)

  useEffect(() => {
    // Check for pending post every 300ms
    const interval = setInterval(async () => {
      const pendingData = await AsyncStorage.getItem(PENDING_POST_KEY)
      setIsCreatingPost(!!pendingData)
    }, 300)

    return () => clearInterval(interval)
  }, [])

  const handlePress = () => {
    if (isCreatingPost) return
    router.push('/(tabs)/create-post')
  }

  const styles = createStyles(colors)

  return (
    <TouchableOpacity
      style={styles.createButton}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={isCreatingPost}
    >
      {isCreatingPost ? (
        <ActivityIndicator size="large" color={colors.white} />
      ) : (
        <Ionicons name="add" size={32} color={colors.white} />
      )}
    </TouchableOpacity>
  )
}

export default function TabLayout() {
  const colors = useThemedColors()
  const { isDark } = useTheme()

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: 90,
            paddingBottom: 30,
            paddingTop: 8,
          },
          tabBarInactiveTintColor: colors.textSecondary,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="house.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: '',
            tabBarIcon: () => null,
            tabBarButton: () => (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <CreateButton />
              </View>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault()
            },
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-circle" size={28} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="create-post"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="create-speech"
          options={{
            href: null,
            animation: 'fade',
            tabBarStyle: { display: 'none' },
          }}
        />
      </Tabs>
    </>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    createButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
  })
