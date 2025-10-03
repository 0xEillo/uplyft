import { FloatingMenu } from '@/components/floating-menu'
import { Ionicons } from '@expo/vector-icons'
import { Tabs, useRouter } from 'expo-router'
import React, { useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import { HapticTab } from '@/components/haptic-tab'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { Colors } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'

function CreateButton() {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)

  const handlePress = () => {
    setShowMenu(!showMenu)
  }

  const handleSpeech = () => {
    setShowMenu(false)
    router.push('/(tabs)/create-speech')
  }

  const handleNotes = () => {
    setShowMenu(false)
    router.push('/(tabs)/create-post')
  }

  return (
    <>
      <FloatingMenu
        visible={showMenu}
        onSpeechPress={handleSpeech}
        onNotesPress={handleNotes}
      />
      <TouchableOpacity
        style={styles.createButton}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Ionicons name={showMenu ? 'close' : 'add'} size={32} color="#fff" />
      </TouchableOpacity>
    </>
  )
}

export default function TabLayout() {
  const colorScheme = useColorScheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          height: 70,
          paddingBottom: 20,
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
            <IconSymbol
              size={28}
              name="person.crop.circle.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="create-post"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="create-speech"
        options={{
          href: null,
        }}
      />
    </Tabs>
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
