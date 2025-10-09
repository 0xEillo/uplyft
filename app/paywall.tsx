import { useSubscription } from '@/contexts/subscription-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function PaywallScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const {
    isPaywallVisible,
    hidePaywall,
    offerings,
    purchasePackage,
    restorePurchases,
    isInTrial,
    trialDaysRemaining,
  } = useSubscription()
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const styles = createStyles(colors)

  const handlePurchase = async () => {
    if (!offerings || !offerings.availablePackages.length) {
      Alert.alert('Error', 'No subscription packages available')
      return
    }

    // Get the monthly package (you can adjust this based on your offering setup)
    const monthlyPackage = offerings.availablePackages[0]

    setIsPurchasing(true)
    try {
      await purchasePackage(monthlyPackage)
      Alert.alert(
        'Success!',
        'Welcome to premium! You can now log unlimited workouts.',
      )
    } catch (error) {
      if (!error.userCancelled) {
        Alert.alert(
          'Purchase Failed',
          'Unable to complete purchase. Please try again.',
        )
      }
    } finally {
      setIsPurchasing(false)
    }
  }

  const handleRestore = async () => {
    setIsRestoring(true)
    try {
      await restorePurchases()
      Alert.alert('Success', 'Your purchases have been restored!')
      hidePaywall()
    } catch (error) {
      Alert.alert(
        'Restore Failed',
        'No previous purchases found or unable to restore.',
      )
    } finally {
      setIsRestoring(false)
    }
  }

  const handleClose = () => {
    hidePaywall()
    router.back()
  }

  const monthlyPackage = offerings?.availablePackages[0]

  return (
    <Modal
      visible={isPaywallVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Ionicons
              name="barbell"
              size={64}
              color={colors.primary}
              style={styles.icon}
            />
            <Text style={styles.title}>Upgrade to Premium</Text>
            <Text style={styles.subtitle}>
              {isInTrial
                ? `Your trial ends in ${trialDaysRemaining} day${
                    trialDaysRemaining !== 1 ? 's' : ''
                  }`
                : 'Subscribe to unlock unlimited workouts'}
            </Text>
          </View>

          {/* Features */}
          <View style={styles.featuresContainer}>
            <Feature
              icon="infinite"
              title="Unlimited Workouts"
              description="Log as many workouts as you want, no limits"
              colors={colors}
            />
            <Feature
              icon="stats-chart"
              title="Advanced Analytics"
              description="Track your progress with detailed insights"
              colors={colors}
            />
            <Feature
              icon="trophy"
              title="Personal Records"
              description="Celebrate your achievements and PRs"
              colors={colors}
            />
            <Feature
              icon="mic"
              title="Voice Logging"
              description="Use voice commands to log workouts faster"
              colors={colors}
            />
          </View>

          {/* Pricing */}
          <View style={styles.pricingContainer}>
            <Text style={styles.pricingTitle}>Monthly Subscription</Text>
            <Text style={styles.price}>
              ${monthlyPackage?.product.priceString || '5.99'}/month
            </Text>
            <Text style={styles.pricingSubtitle}>
              Cancel anytime, no commitment
            </Text>
          </View>

          {/* Subscribe Button */}
          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={handlePurchase}
            disabled={isPurchasing || !offerings}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.subscribeButtonText}>Start Subscription</Text>
            )}
          </TouchableOpacity>

          {/* Restore Button */}
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.restoreButtonText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.terms}>
            Subscription automatically renews unless cancelled at least 24 hours
            before the end of the current period. Manage your subscription in
            App Store settings.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function Feature({
  icon,
  title,
  description,
  colors,
}: {
  icon: any
  title: string
  description: string
  colors: any
}) {
  const styles = createStyles(colors)

  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  )
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.white,
    },
    scrollContent: {
      padding: 24,
    },
    closeButton: {
      alignSelf: 'flex-end',
      padding: 8,
      marginBottom: 16,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
    },
    icon: {
      marginBottom: 16,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    featuresContainer: {
      marginBottom: 32,
    },
    feature: {
      flexDirection: 'row',
      marginBottom: 20,
      alignItems: 'flex-start',
    },
    featureIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    featureContent: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    pricingContainer: {
      alignItems: 'center',
      marginBottom: 24,
      padding: 24,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 16,
    },
    pricingTitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    price: {
      fontSize: 40,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 8,
    },
    pricingSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    subscribeButton: {
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 16,
    },
    subscribeButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#fff',
    },
    restoreButton: {
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 24,
    },
    restoreButtonText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
    },
    terms: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
  })
}
