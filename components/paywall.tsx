import { useSubscription } from '@/contexts/subscription-context'
import {
  calculateYearlySavings,
  useRevenueCatPackages,
} from '@/hooks/useRevenueCatPackages'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { PACKAGE_TYPE } from 'react-native-purchases'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const PLAN_PLACEHOLDERS = new Set(['monthly_placeholder', 'yearly_placeholder'])

type PaywallProps = {
  visible: boolean
  onClose: () => void
  title?: string
  message?: string
}

export function Paywall({
  visible,
  onClose,
  title = 'Premium Feature',
  message = 'This feature requires a subscription to Rep AI.',
}: PaywallProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const insets = useSafeAreaInsets()
  const {
    purchasePackage,
    restorePurchases,
    offerings,
    isLoading,
  } = useSubscription()
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const { monthly, yearly, lifetime, available } = useRevenueCatPackages(
    offerings,
  )

  useEffect(() => {
    const selectedExists =
      selectedPlan && available.some((pkg) => pkg.identifier === selectedPlan)

    if (
      selectedPlan &&
      !selectedExists &&
      !PLAN_PLACEHOLDERS.has(selectedPlan)
    ) {
      const fallbackId =
        monthly?.identifier ?? yearly?.identifier ?? lifetime?.identifier ?? null

      if (fallbackId && fallbackId !== selectedPlan) {
        setSelectedPlan(fallbackId)
      } else if (!fallbackId && selectedPlan !== 'monthly_placeholder') {
        setSelectedPlan('monthly_placeholder')
      }
      return
    }

    if (selectedPlan === 'monthly_placeholder' && monthly) {
      setSelectedPlan(monthly.identifier)
      return
    }

    if (selectedPlan === 'yearly_placeholder' && yearly) {
      setSelectedPlan(yearly.identifier)
      return
    }

    if (!selectedPlan) {
      if (monthly) {
        setSelectedPlan(monthly.identifier)
      } else if (yearly) {
        setSelectedPlan(yearly.identifier)
      } else if (lifetime) {
        setSelectedPlan(lifetime.identifier)
      } else if (selectedPlan !== 'monthly_placeholder') {
        setSelectedPlan('monthly_placeholder')
      }
    }
  }, [
    available,
    lifetime?.identifier,
    monthly,
    selectedPlan,
    yearly,
  ])

  const yearlySavings = useMemo(
    () => calculateYearlySavings(monthly, yearly),
    [monthly, yearly],
  )

  const selectedPackage = useMemo(() => {
    if (!selectedPlan) return null

    const match = available.find((pkg) => pkg.identifier === selectedPlan)
    if (match) return match

    if (monthly?.identifier === selectedPlan) return monthly
    if (yearly?.identifier === selectedPlan) return yearly
    if (lifetime?.identifier === selectedPlan) return lifetime
    return null
  }, [
    available,
    lifetime?.identifier,
    monthly?.identifier,
    selectedPlan,
    yearly?.identifier,
  ])

  const subscribeButtonText = useMemo(() => {
    if (!selectedPackage) return 'Select a plan'
    if (selectedPackage.packageType === PACKAGE_TYPE.LIFETIME) {
      return 'Unlock Lifetime access'
    }
    if (selectedPackage.packageType === PACKAGE_TYPE.ANNUAL) {
      return 'Start Yearly Free Trial'
    }
    return 'Start 7-Day Free Trial'
  }, [selectedPackage])

  const trialInfoText = useMemo(() => {
    if (!selectedPackage) {
      return 'Select a plan to see billing details.'
    }

    if (selectedPackage.packageType === PACKAGE_TYPE.LIFETIME) {
      return `${selectedPackage.product.priceString} lifetime access`
    }

    const cadence =
      selectedPackage.packageType === PACKAGE_TYPE.ANNUAL ? 'year' : 'month'
    return `7 days free, then ${selectedPackage.product.priceString}/${cadence}`
  }, [selectedPackage])

  const handleSubscribe = async () => {
    try {
      setIsPurchasing(true)

      if (!selectedPackage) {
        Alert.alert('Error', 'Please select a subscription plan.')
        return
      }

      const updatedCustomerInfo = await purchasePackage(
        selectedPackage.identifier,
      )

      // Verify the Pro entitlement was actually granted
      const hasProEntitlement = Boolean(
        updatedCustomerInfo?.entitlements.active['Pro'],
      )

      if (hasProEntitlement) {
        // Purchase successful and entitlement verified - close the paywall
        Alert.alert(
          'Success!',
          'Your subscription is now active. Enjoy all premium features!',
          [{ text: 'OK', onPress: onClose }],
        )
      } else {
        // Purchase succeeded but entitlement not granted - this is rare but possible
        Alert.alert(
          'Subscription Pending',
          "Your purchase was successful, but it may take a moment to activate. Please restart the app if you still don't have access.",
          [{ text: 'OK' }],
        )
      }
    } catch (error) {
      // Handle user cancellation
      if (error?.userCancelled) {
        return
      }

      Alert.alert(
        'Purchase Failed',
        error?.message || 'Unable to complete purchase. Please try again.',
        [{ text: 'OK' }],
      )
    } finally {
      setIsPurchasing(false)
    }
  }

  const handleRestore = async () => {
    try {
      setIsRestoring(true)
      const restoredCustomerInfo = await restorePurchases()

      // Check if Pro entitlement was restored
      const hasProEntitlement = Boolean(
        restoredCustomerInfo?.entitlements.active['Pro'],
      )

      if (hasProEntitlement) {
        Alert.alert('Success!', 'Your purchases have been restored.', [
          { text: 'OK', onPress: onClose },
        ])
      } else {
        Alert.alert(
          'No Purchases Found',
          'No previous purchases were found for this account.',
          [{ text: 'OK' }],
        )
      }
    } catch {
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please try again.',
        [{ text: 'OK' }],
      )
    } finally {
      setIsRestoring(false)
    }
  }

  const handleOpenTerms = async () => {
    const termsUrl = 'https://www.repaifit.app/terms'
    try {
      const canOpen = await Linking.canOpenURL(termsUrl)
      if (canOpen) {
        await Linking.openURL(termsUrl)
      }
    } catch (error) {
      console.error('[Paywall] Failed to open terms:', error)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Fixed Close Button */}
          <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollableContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={true}
            scrollIndicatorInsets={{ right: 4 }}
            persistentScrollbar={true}
          >
            {/* Top Section - Title */}
            <View style={styles.topSection}>
              <View style={styles.brandHeader}>
                <Text style={styles.brandName}>Rep AI</Text>
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              </View>
            </View>

            {/* Heading */}
            <Text style={styles.heading}>Full Access</Text>

            {/* Description */}
            <Text style={styles.description}>
              Get access to all PRO features and take your training to the next
              level.
            </Text>

            {/* Subscription Plans */}
            <View style={styles.plansContainer}>
              {monthly && (
                <PlanCard
                  title="PRO MONTHLY"
                  price={monthly.product.priceString}
                  billing="Billed monthly"
                  isSelected={selectedPlan === monthly.identifier}
                  onSelect={() => setSelectedPlan(monthly.identifier)}
                  colors={colors}
                />
              )}
              {yearly ? (
                <PlanCard
                  title="PRO YEARLY"
                  price={yearly.product.priceString}
                  billing="Billed annually"
                  isSelected={selectedPlan === yearly.identifier}
                  onSelect={() => setSelectedPlan(yearly.identifier)}
                  colors={colors}
                  savings={yearlySavings}
                />
              ) : (
                <PlanCard
                  title="PRO YEARLY"
                  price="$24.99"
                  billing="Billed annually"
                  isSelected={selectedPlan === 'yearly_placeholder'}
                  onSelect={() => setSelectedPlan('yearly_placeholder')}
                  colors={colors}
                  savings={58}
                />
              )}
              {lifetime && (
                <PlanCard
                  title="PRO LIFETIME"
                  price={lifetime.product.priceString}
                  billing="Pay once"
                  isSelected={selectedPlan === lifetime.identifier}
                  onSelect={() => setSelectedPlan(lifetime.identifier)}
                  colors={colors}
                />
              )}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Text style={styles.trialInfoText}>{trialInfoText}</Text>

              <TouchableOpacity
                style={styles.subscribeButton}
                onPress={handleSubscribe}
                disabled={
                  isPurchasing || isRestoring || isLoading || !selectedPackage
                }
              >
                {isPurchasing ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <Text style={styles.subscribeButtonText}>
                    {subscribeButtonText}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.notNowButton}
                onPress={onClose}
                disabled={isPurchasing || isRestoring}
              >
                <Text style={styles.notNowText}>Not now</Text>
              </TouchableOpacity>

              <Text style={styles.cancelText}>
                Cancel anytime during your trial.
              </Text>
            </View>

            {/* User Reviews */}
            <View style={styles.reviewsSection}>
              <View style={styles.reviewsHeader}>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name="star"
                      size={24}
                      color={colors.primary}
                    />
                  ))}
                </View>
                <Text style={styles.reviewsTitle}>
                  What our users are saying
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.reviewsScrollContainer}
                style={styles.reviewsScrollView}
              >
                <ReviewCard
                  title="Super quick to log workouts"
                  rating={5}
                  reviewer="Oliver.R.J"
                  date="Fri"
                  review="This is by far the best weight training tracker app I have ever used. I downloaded so many (even paid for one) and Rep AI was the best for so many different reasons! Love the community on here too :)"
                  colors={colors}
                />
                <ReviewCard
                  title="Clean, efficient and effective"
                  rating={5}
                  reviewer="Matthew M R"
                  date="4 Nov"
                  review="The app is super easy to use, has great features like BMI calculation and an AI chatbot for motivation. It's improved my workout quality and tracks everything intelligently. Setting and achieving goals with AI help has been amazing."
                  colors={colors}
                />
                <ReviewCard
                  title="Great app"
                  rating={5}
                  reviewer="Norwichfan500"
                  date="Fri"
                  review="Helped me reach my goals and get trim for a winter holiday. Highly recommend it!"
                  colors={colors}
                />
              </ScrollView>
            </View>

            {/* Comparison Section */}
            <View style={styles.comparisonSection}>
              <Text style={styles.comparisonTitle}>Need to compare?</Text>

              <View style={styles.comparisonTable}>
                {/* Header Row */}
                <View style={styles.comparisonHeaderRow}>
                  <View style={styles.comparisonFeatureColumn}>
                    <Text></Text>
                  </View>
                  <View style={styles.comparisonValueColumn}>
                    <Text style={styles.comparisonHeaderText}>Free</Text>
                  </View>
                  <View style={styles.comparisonValueColumn}>
                    <Text style={styles.comparisonHeaderTextPro}>Pro</Text>
                  </View>
                </View>

                {/* Feature Rows */}
                <ComparisonRow
                  feature="Unlimited Workouts"
                  free="3 per week"
                  pro={true}
                  colors={colors}
                />
                <ComparisonRow
                  feature="Unlimited Routines"
                  free={false}
                  pro={true}
                  colors={colors}
                />
                <ComparisonRow
                  feature="Custom Exercises"
                  free={false}
                  pro={true}
                  colors={colors}
                />
                <ComparisonRow
                  feature="Advanced Stats"
                  free={false}
                  pro={true}
                  colors={colors}
                />
                <ComparisonRow
                  feature="Body Scanning"
                  free={false}
                  pro={true}
                  colors={colors}
                />
              </View>
            </View>

            {/* FAQ Section */}
            <View style={styles.faqSection}>
              <Text style={styles.faqTitle}>Any Questions?</Text>
              {faqData.map((faq, index) => (
                <FAQItem
                  key={index}
                  question={faq.question}
                  answer={faq.answer}
                  isExpanded={expandedFaq === index}
                  onToggle={() =>
                    setExpandedFaq(expandedFaq === index ? null : index)
                  }
                  colors={colors}
                />
              ))}
            </View>

            {/* Support & Legal */}
            <View style={styles.supportSection}>
              <Text style={styles.supportText}>
                Having issues with your subscription?
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('mailto:support@repaifit.app')}
              >
                <Text style={styles.emailLink}>
                  Contact us at support@repaifit.app
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestore}
                disabled={isPurchasing || isRestoring || isLoading}
              >
                {isRestoring ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.restoreButtonText}>
                    Restore Purchases
                  </Text>
                )}
              </TouchableOpacity>
              <View style={styles.legalLinks}>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL('https://www.repaifit.app/privacy')
                  }
                >
                  <Text style={styles.legalLink}>Privacy Policy</Text>
                </TouchableOpacity>
                <Text style={styles.legalSeparator}> • </Text>
                <TouchableOpacity onPress={handleOpenTerms}>
                  <Text style={styles.legalLink}>Terms & Conditions</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// FAQ Data
const faqData = [
  {
    question: 'What does Rep AI Pro include?',
    answer:
      'Rep AI Pro includes unlimited workout logging, AI-powered fitness assistant, advanced stats tracking, body scanning & analysis, unlimited custom exercises, and priority support.',
  },
  {
    question:
      'Is Rep AI Pro a one-time payment or will it renew automatically?',
    answer:
      'Rep AI Pro offers both monthly and yearly subscription plans that renew automatically, as well as a lifetime plan that is a one-time payment.',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer:
      'Yes, you can cancel your subscription at any time. Your access will continue until the end of your current billing period.',
  },
  {
    question: 'Is it possible to get a refund?',
    answer:
      'Refunds are handled through the App Store or Google Play Store according to their respective refund policies. Please contact us if you have any issues.',
  },
  {
    question: 'Can I switch subscription plans?',
    answer:
      'Yes, you can switch between monthly, yearly, and lifetime plans at any time. Changes will take effect at the start of your next billing cycle.',
  },
  {
    question: 'How does the Rep AI Pro Lifetime plan work?',
    answer:
      'The Lifetime plan is a one-time payment that gives you permanent access to all Pro features with no recurring charges.',
  },
  {
    question: 'What happens if I switch devices or platforms?',
    answer:
      'Your subscription is tied to your account, so you can access Pro features on any device where you sign in with the same account.',
  },
]

function ReviewCard({
  title,
  rating,
  reviewer,
  date,
  review,
  colors,
}: {
  title: string
  rating: number
  reviewer: string
  date: string
  review: string
  colors: any
}) {
  const styles = createStyles(colors)

  return (
    <View style={styles.reviewCard}>
      <Text style={styles.reviewCardTitle}>{title}</Text>
      <View style={styles.reviewCardHeader}>
        <View style={styles.reviewCardStars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons key={star} name="star" size={16} color={colors.primary} />
          ))}
        </View>
        <Text style={styles.reviewCardMeta}>
          {date} · {reviewer}
        </Text>
      </View>
      <Text style={styles.reviewCardText}>{review}</Text>
    </View>
  )
}

function FAQItem({
  question,
  answer,
  isExpanded,
  onToggle,
  colors,
}: {
  question: string
  answer: string
  isExpanded: boolean
  onToggle: () => void
  colors: any
}) {
  const styles = createStyles(colors)

  return (
    <View style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqQuestion}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.faqQuestionText}>{question}</Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {isExpanded && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{answer}</Text>
        </View>
      )}
    </View>
  )
}

function ComparisonRow({
  feature,
  free,
  pro,
  colors,
}: {
  feature: string
  free: boolean | string
  pro: boolean | string
  colors: any
}) {
  const styles = createStyles(colors)

  const renderValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Ionicons name="checkmark" size={24} color={colors.primary} />
      ) : (
        <Text style={styles.comparisonDisabled}>—</Text>
      )
    }
    return <Text style={styles.comparisonLimitedText}>{value}</Text>
  }

  return (
    <View style={styles.comparisonRow}>
      <View style={styles.comparisonFeatureColumn}>
        <Text style={styles.comparisonFeatureText}>{feature}</Text>
      </View>
      <View style={styles.comparisonValueColumn}>{renderValue(free)}</View>
      <View style={styles.comparisonValueColumn}>{renderValue(pro)}</View>
    </View>
  )
}

function PlanCard({
  title,
  price,
  billing,
  isSelected,
  onSelect,
  colors,
  savings,
}: {
  title: string
  price: string
  billing: string
  isSelected: boolean
  onSelect: () => void
  colors: any
  savings?: number | null
}) {
  const styles = createStyles(colors)

  return (
    <TouchableOpacity
      style={[styles.planCard, isSelected && styles.planCardSelected]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      {savings && savings > 0 && (
        <View style={styles.savingsBadge}>
          <Text style={styles.savingsBadgeText}>SAVE {savings}%</Text>
        </View>
      )}
      <View style={styles.planCardContent}>
        <View style={styles.planTitleRow}>
          <Text style={styles.planTitleYellow}>PRO</Text>
          <Text style={styles.planTitleBlue}>
            {title.replace('PRO ', '').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.planPrice}>{price}</Text>
        <Text style={styles.planBilling}>{billing}</Text>
      </View>
    </TouchableOpacity>
  )
}

function createStyles(colors: any) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    overlay: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
      flexDirection: 'column',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 20,
      width: '100%',
      backgroundColor: colors.background,
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topSection: {
      paddingTop: 60,
      paddingBottom: 24,
      width: '100%',
      alignItems: 'center',
    },
    brandHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    scrollableContent: {
      flex: 1,
    },
    scrollContentContainer: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      alignItems: 'center',
    },
    brandName: {
      fontSize: 48,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -1,
    },
    proBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    proBadgeText: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.buttonText,
    },
    heading: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginTop: 112,
      marginBottom: 12,
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 48,
      lineHeight: 22,
      paddingHorizontal: 8,
    },
    plansContainer: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 16,
      paddingHorizontal: 0,
    },
    planCard: {
      flex: 1,
      maxWidth: 180,
      backgroundColor: colors.background,
      borderWidth: 3,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 16,
      position: 'relative',
    },
    planCardSelected: {
      borderColor: colors.primary,
      borderWidth: 3,
    },
    savingsBadge: {
      position: 'absolute',
      top: -10,
      right: 12,
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      zIndex: 10,
    },
    savingsBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.buttonText,
    },
    planCardContent: {
      alignItems: 'flex-start',
    },
    planTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 16,
    },
    planTitleYellow: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    planTitleBlue: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    planPrice: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    planBilling: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    reviewsSection: {
      width: '100%',
      marginTop: 22,
      marginBottom: 48,
    },
    comparisonSection: {
      width: '100%',
      marginBottom: 40,
    },
    comparisonTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 24,
    },
    comparisonTable: {
      width: '100%',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    comparisonHeaderRow: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    comparisonRow: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    comparisonFeatureColumn: {
      flex: 2,
    },
    comparisonValueColumn: {
      flex: 1,
      alignItems: 'center',
    },
    comparisonHeaderText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    comparisonHeaderTextPro: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    comparisonFeatureText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    comparisonLimitedText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    comparisonDisabled: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    reviewsHeader: {
      alignItems: 'center',
      marginBottom: 20,
    },
    starsContainer: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 12,
    },
    reviewsTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    reviewsSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    reviewsScrollView: {
      marginHorizontal: -24,
    },
    reviewsScrollContainer: {
      paddingHorizontal: 24,
      gap: 12,
    },
    reviewCard: {
      width: 300,
      backgroundColor: colors.backgroundLight || colors.background,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reviewCardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    reviewCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    reviewCardStars: {
      flexDirection: 'row',
      gap: 2,
    },
    reviewCardMeta: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    reviewCardText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    faqSection: {
      width: '100%',
      marginBottom: 32,
    },
    faqTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 24,
    },
    faqItem: {
      backgroundColor: colors.backgroundLight || colors.background,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    faqQuestion: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
    },
    faqQuestionText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      marginRight: 12,
    },
    faqAnswer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    faqAnswerText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    supportSection: {
      width: '100%',
      alignItems: 'center',
      marginTop: 8,
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    supportText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
      textAlign: 'center',
    },
    emailLink: {
      fontSize: 14,
      color: colors.primary,
      marginBottom: 16,
      textAlign: 'center',
    },
    legalLinks: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    legalLink: {
      fontSize: 14,
      color: colors.primary,
    },
    legalSeparator: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    actions: {
      width: '100%',
      paddingTop: 0,
      paddingBottom: 32,
      gap: 0,
    },
    trialInfoText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
    },
    subscribeButton: {
      height: 48,
      backgroundColor: colors.primary,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    subscribeButtonText: {
      color: colors.buttonText,
      fontSize: 18,
      fontWeight: '700',
    },
    notNowButton: {
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notNowText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
    cancelText: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: -4,
    },
    restoreButton: {
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 4,
    },
    restoreButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    termsLink: {
      marginTop: -8,
      paddingVertical: 0,
      alignItems: 'center',
    },
    termsText: {
      fontSize: 12,
      color: colors.textSecondary,
      textDecorationLine: 'underline',
      opacity: 0.7,
    },
  })
}
