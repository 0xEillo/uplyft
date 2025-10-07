import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { Link, router } from 'expo-router'
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function WelcomeScreen() {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Title */}
        <View style={styles.header}>
          <Image
            source={require('@/llm/bell-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Uplyft</Text>
          <Text style={styles.subtitle}>
            Track your gains, share your progress
          </Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="barbell" size={32} color={colors.primary} />
            <Text style={styles.featureText}>Track your workouts</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="trending-up" size={32} color={colors.primary} />
            <Text style={styles.featureText}>Monitor your progress</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="people" size={32} color={colors.primary} />
            <Text style={styles.featureText}>Share with friends</Text>
          </View>
        </View>

        {/* CTA Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={() => router.push('/(auth)/onboarding')}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.signInButton}>
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
          </Link>
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
      alignItems: 'center',
      marginTop: 48,
    },
    logo: {
      width: 160,
      height: 160,
    },
    title: {
      fontSize: 48,
      fontWeight: '700',
      color: colors.text,
      marginTop: 24,
    },
    subtitle: {
      fontSize: 18,
      color: colors.textSecondary,
      marginTop: 12,
      textAlign: 'center',
    },
    features: {
      gap: 32,
    },
    feature: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    featureText: {
      fontSize: 18,
      fontWeight: '500',
      color: colors.text,
    },
    actions: {
      gap: 16,
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
