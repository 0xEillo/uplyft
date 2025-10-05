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
import { Colors } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'

const PENDING_POST_KEY = '@pending_workout_post'

function CreateButton() {
  const router = useRouter()
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

  return (
    <TouchableOpacity
      style={styles.createButton}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={isCreatingPost}
    >
      {isCreatingPost ? (
        <ActivityIndicator size="large" color="#fff" />
      ) : (
        <Ionicons name="add" size={32} color="#fff" />
      )}
    </TouchableOpacity>
  )
}

export default function TabLayout() {
  const colorScheme = useColorScheme()

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#f0f0f0',
            height: 90,
            paddingBottom: 30,
            paddingTop: 8,
          },
          tabBarInactiveTintColor: '#999',
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
              <View style={styles.createButtonContainer}>
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
    </>
  )
}

const styles = StyleSheet.create({
  createButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
})
