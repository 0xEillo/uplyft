import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Link, router } from 'expo-router'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function WelcomeScreen() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const styles = createStyles(colors)
  const logoSource = isDark
    ? require('@/llm/repai-logo-white.png')
    : require('@/llm/repai-logo-black.png')

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo & Title */}
        <View style={styles.header}>
          <Image source={logoSource} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Rep AI</Text>
        </View>

        {/* Hook & CTA */}
        <View style={styles.actions}>
          <Text style={styles.subtitle}>Workout tracking made easy</Text>
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={() => router.push('/(auth)/onboarding')}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
          <View style={styles.signInRow}>
            <Text style={styles.signInPrompt}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.signInLink}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 32,
      justifyContent: 'space-between',
      paddingVertical: 48,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 96,
    },
    logo: {
      width: 76,
      height: 76,
      marginRight: 0,
    },
    title: {
      fontSize: 48,
      fontWeight: '700',
      color: colors.text,
      marginTop: 0,
    },
    subtitle: {
      fontSize: 26,
      color: '#d5d5d5',
      fontWeight: '500',
      marginTop: 0,
      textAlign: 'center',
    },
    actions: {
      gap: 16,
    },
    signInRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    signInPrompt: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    signInLink: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    getStartedButton: {
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    getStartedText: {
      color: colors.buttonText,
      fontSize: 18,
      fontWeight: '700',
    },
    signInButton: {
      height: 56,
      justifyContent: 'center',
      alignItems: 'center',
    },
    signInText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
  })
