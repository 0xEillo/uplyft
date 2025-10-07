import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import 'react-native-reanimated'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { PostsProvider } from '@/contexts/posts-context'
import { ThemeProvider, useTheme } from '@/contexts/theme-context'

function RootLayoutNav() {
  const { user, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const { isDark } = useTheme()

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!user && !inAuthGroup) {
      // Redirect to welcome screen if not authenticated
      router.replace('/(auth)/welcome')
    } else if (user && inAuthGroup) {
      // Redirect to app if authenticated
      router.replace('/(tabs)')
    }
  }, [user, segments, isLoading])

  return (
    <>
      <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Slot />
      </NavigationThemeProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <PostsProvider>
            <RootLayoutNav />
          </PostsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
