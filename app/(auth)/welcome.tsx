import { Ionicons } from '@expo/vector-icons'
import { Link, router } from 'expo-router'
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Title */}
        <View style={styles.header}>
          <Ionicons name="fitness" size={80} color="#FF6B35" />
          <Text style={styles.title}>Uplyft</Text>
          <Text style={styles.subtitle}>
            Track your gains, share your progress
          </Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="barbell" size={32} color="#FF6B35" />
            <Text style={styles.featureText}>Track your workouts</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="trending-up" size={32} color="#FF6B35" />
            <Text style={styles.featureText}>Monitor your progress</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="people" size={32} color="#FF6B35" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 24,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
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
    color: '#1a1a1a',
  },
  actions: {
    gap: 16,
  },
  getStartedButton: {
    height: 56,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  getStartedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  signInButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
  },
})
