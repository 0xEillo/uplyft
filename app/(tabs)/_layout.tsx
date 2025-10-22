import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Tabs, useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'

import { HapticTab } from '@/components/haptic-tab'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
  SuccessOverlayProvider,
  useSuccessOverlay,
} from '@/contexts/success-overlay-context'
import { SubmitSuccessOverlay } from '@/components/submit-success-overlay'

const PENDING_POST_KEY = '@pending_workout_post'
const DRAFT_KEY = '@workout_draft'

function CreateButton() {
  const router = useRouter()
  const colors = useThemedColors()
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const spinValue = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Check for pending post and draft every 300ms
    const interval = setInterval(async () => {
      const pendingData = await AsyncStorage.getItem(PENDING_POST_KEY)
      const draftData = await AsyncStorage.getItem(DRAFT_KEY)
      setIsCreatingPost(!!pendingData)
      setHasDraft(!!draftData && draftData.trim().length > 0)
    }, 300)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isCreatingPost) {
      // Start smooth spinning animation
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start()
    } else {
      // Reset
      spinValue.setValue(0)
    }
  }, [isCreatingPost, spinValue])

  const handlePress = () => {
    if (isCreatingPost) return
    router.push('/(tabs)/create-post')
  }

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const styles = createStyles(colors)

  return (
    <TouchableOpacity
      style={[
        styles.createButton,
        hasDraft && !isCreatingPost && styles.createButtonWithDraft,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={isCreatingPost}
    >
      {isCreatingPost ? (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <View style={styles.loaderRing}>
            <View style={styles.loaderArc} />
          </View>
        </Animated.View>
      ) : (
        <Ionicons
          name={hasDraft ? 'document-text' : 'add'}
          size={32}
          color={colors.white}
        />
      )}
    </TouchableOpacity>
  )
}

function TabLayoutContent() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { isVisible, data, hideOverlay } = useSuccessOverlay()

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
            tabBarStyle: { display: 'none' },
          }}
        />
      </Tabs>
      <SubmitSuccessOverlay
        visible={isVisible}
        onAnimationComplete={hideOverlay}
        message={data.message}
        workoutNumber={data.workoutNumber}
        weeklyTarget={data.weeklyTarget}
      />
    </>
  )
}

export default function TabLayout() {
  return (
    <SuccessOverlayProvider>
      <TabLayoutContent />
    </SuccessOverlayProvider>
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
    createButtonWithDraft: {
      backgroundColor: colors.primaryDark,
      shadowOpacity: 0.4,
    },
    loaderRing: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 3,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loaderArc: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 3,
      borderColor: 'transparent',
      borderTopColor: '#ffffff',
      borderRightColor: '#ffffff',
    },
  })
