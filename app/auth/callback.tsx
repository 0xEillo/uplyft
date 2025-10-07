import { useThemedColors } from '@/hooks/useThemedColors'
import { supabase } from '@/lib/supabase'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

export default function AuthCallback() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const styles = createStyles(colors)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const accessToken = params.access_token as string
        const refreshToken = params.refresh_token as string

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          router.replace('/(tabs)')
        } else {
          router.replace('/(auth)/login')
        }
      } catch (error) {
        console.error('Error handling auth callback:', error)
        router.replace('/(auth)/login')
      }
    }

    handleCallback()
  }, [params])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    text: {
      marginTop: 16,
      fontSize: 16,
      color: colors.text,
    },
  })
