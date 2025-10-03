import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import 'react-native-reanimated'

import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { PostsProvider } from '@/contexts/posts-context'
import { useColorScheme } from '@/hooks/use-color-scheme'

function RootLayoutNav() {
  const { user, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login')
    } else if (user && inAuthGroup) {
      // Redirect to app if authenticated
      router.replace('/(tabs)')
    }
  }, [user, segments, isLoading])

  return <Slot />
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <AuthProvider>
      <PostsProvider>
        <ThemeProvider
          value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
        >
          <RootLayoutNav />
          <StatusBar style="auto" />
        </ThemeProvider>
      </PostsProvider>
    </AuthProvider>
  )
}
