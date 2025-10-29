import {
  cancelTrialNotification,
  checkAndRescheduleTrialNotification,
} from '@/lib/services/notification-service'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Alert, Platform } from 'react-native'
import type { CustomerInfoUpdateListener } from 'react-native-purchases'
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
} from 'react-native-purchases'
import { useAuth } from './auth-context'

type SubscriptionContextValue = {
  customerInfo: CustomerInfo | null
  offerings: PurchasesOffering | null
  isProMember: boolean
  isLoading: boolean
  restorePurchases: () => Promise<CustomerInfo>
  purchasePackage: (packageId: string) => Promise<CustomerInfo>
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(
  undefined,
)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasConfigured, setHasConfigured] = useState(false)
  const customerInfoListenerRef = useRef<CustomerInfoUpdateListener | null>(
    null,
  )

  // Configure RevenueCat SDK once on mount
  useEffect(() => {
    let isActive = true

    const configureRevenueCat = async () => {
      try {
        // Check if running in Expo Go (not supported)
        const isExpoGo = Constants.appOwnership === 'expo'
        if (isExpoGo) {
          console.warn(
            '[RevenueCat] Running in Expo Go - RevenueCat requires a development build. Skipping initialization.',
          )
          setIsLoading(false)
          return
        }

        // Set log level for debugging (set to ERROR in production)
        Purchases.setLogLevel(LOG_LEVEL.ERROR)

        // Get API keys from config
        const testStoreKey = Constants.expoConfig?.extra
          ?.revenueCatTestStoreKey as string | undefined
        const appleApiKey = Constants.expoConfig?.extra
          ?.revenueCatAppleApiKey as string | undefined
        const googleApiKey = Constants.expoConfig?.extra
          ?.revenueCatGoogleApiKey as string | undefined

        const shouldUseTestStore = Boolean(
          Constants.expoConfig?.extra?.revenueCatUseTestStore,
        )

        // Prioritize Test Store key for testing
        let apiKeyToUse: string | undefined
        if (shouldUseTestStore && testStoreKey) {
          apiKeyToUse = testStoreKey
        } else if (Platform.OS === 'ios' && appleApiKey) {
          apiKeyToUse = appleApiKey
        } else if (Platform.OS === 'android' && googleApiKey) {
          apiKeyToUse = googleApiKey
        }

        // Validate API key exists
        if (!apiKeyToUse) {
          console.warn('[RevenueCat] No API key configured')
          setIsLoading(false)
          return
        }

        // Configure SDK once (do NOT reconfigure on user changes)
        await Purchases.configure({ apiKey: apiKeyToUse })
        if (!isActive) {
          return
        }

        setHasConfigured(true)
        if (!isActive) {
          return
        }

        const listener: CustomerInfoUpdateListener = (info) => {
          setCustomerInfo(info)
        }
        Purchases.addCustomerInfoUpdateListener(listener)
        customerInfoListenerRef.current = listener

        const currentCustomerInfo = await Purchases.getCustomerInfo()
        const currentOfferings = await Purchases.getOfferings()

        if (!isActive) {
          if (customerInfoListenerRef.current) {
            Purchases.removeCustomerInfoUpdateListener(
              customerInfoListenerRef.current,
            )
            customerInfoListenerRef.current = null
          }
          return
        }

        setCustomerInfo(currentCustomerInfo)
        setOfferings(currentOfferings.current)
      } catch (error) {
        console.error('[RevenueCat] Configuration error:', error)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    configureRevenueCat()

    return () => {
      isActive = false
      if (customerInfoListenerRef.current) {
        Purchases.removeCustomerInfoUpdateListener(
          customerInfoListenerRef.current,
        )
        customerInfoListenerRef.current = null
      }
    }
  }, []) // Only run once on mount

  // Handle user login separately
  useEffect(() => {
    if (isLoading || !hasConfigured) {
      return
    }

    const syncRevenueCatUser = async () => {
      try {
        const currentAppUserId = await Purchases.getAppUserID()

        if (user?.id) {
          if (currentAppUserId === user.id) {
            return
          }
          const { customerInfo: info } = await Purchases.logIn(user.id)
          setCustomerInfo(info)
        } else {
          if (currentAppUserId.startsWith('$RCAnonymousID')) {
            return
          }
          const info = await Purchases.logOut()
          setCustomerInfo(info)
        }
      } catch (error) {
        console.error('[RevenueCat] User sync error:', error)
      }
    }

    syncRevenueCatUser()
  }, [user?.id, isLoading, hasConfigured]) // Run when user ID changes or initialization completes

  // Check if user has Pro entitlement (case-sensitive: must match RevenueCat dashboard)
  const proEntitlement = customerInfo?.entitlements.active['Pro']
  const isTrialing = proEntitlement?.periodType === 'trial'
  const hasPaidEntitlement = Boolean(proEntitlement && !isTrialing)
  const isProMember = Boolean(proEntitlement)

  // Handle trial notification based on subscription status
  useEffect(() => {
    if (!user?.id || isLoading) return

    const handleNotifications = async () => {
      try {
        if (hasPaidEntitlement) {
          // User converted to a paid subscription - clear any trial reminders
          await cancelTrialNotification(user.id)
          return
        }

        // Trial or free user - ensure the reminder is scheduled if applicable
        await checkAndRescheduleTrialNotification(
          user.id,
          hasPaidEntitlement,
          proEntitlement?.latestPurchaseDate ||
            proEntitlement?.originalPurchaseDate ||
            undefined,
        )
      } catch (error) {
        console.error('[Subscription] Notification handling error:', error)
      }
    }

    handleNotifications()
  }, [user?.id, isLoading, hasPaidEntitlement, proEntitlement])

  // In-app reminder the day before trial ends (no OS push)
  useEffect(() => {
    const maybeShowInAppTrialReminder = async () => {
      try {
        if (!user?.id || isLoading) return
        if (!proEntitlement) return
        if (hasPaidEntitlement) return

        // Only relevant during trial period
        const isTrial = proEntitlement?.periodType === 'trial'
        if (!isTrial) return

        // Determine expiration date
        let expiration: Date | null = null
        if (proEntitlement?.expirationDate) {
          expiration = new Date(proEntitlement.expirationDate)
        }

        // Fallback: if no expiration provided, derive from latest purchase/original purchase + 7 days
        if (!expiration) {
          const anchorStr =
            proEntitlement?.latestPurchaseDate ||
            proEntitlement?.originalPurchaseDate ||
            null
          if (!anchorStr) return
          const anchor = new Date(anchorStr)
          const exp = new Date(anchor)
          exp.setDate(exp.getDate() + 7)
          expiration = exp
        }

        if (!expiration) return

        const now = new Date()
        const reminder = new Date(expiration)
        reminder.setDate(reminder.getDate() - 1)

        // Only show on the reminder day window (>= reminder and < expiration)
        if (!(now >= reminder && now < expiration)) return

        // Prevent duplicate alerts per user per expiration date
        const expKeyDate = expiration.toISOString().slice(0, 10)
        const shownKey = `@trial_reminder_shown_${user.id}_${expKeyDate}`
        const alreadyShown = await AsyncStorage.getItem(shownKey)
        if (alreadyShown === '1') return

        Alert.alert(
          'Trial ends tomorrow',
          'Your 7-day free trial ends in 24 hours. You can cancel anytime in Settings.',
          [{ text: 'OK' }],
        )
        await AsyncStorage.setItem(shownKey, '1')
      } catch (err) {
        // Non-fatal
        console.warn('[Subscription] In-app trial reminder error:', err)
      }
    }

    maybeShowInAppTrialReminder()
  }, [user?.id, isLoading, hasPaidEntitlement, proEntitlement])

  // Restore purchases
  const restorePurchases = async (): Promise<CustomerInfo> => {
    try {
      const info = await Purchases.restorePurchases()
      setCustomerInfo(info)
      return info
    } catch (error) {
      console.error('[RevenueCat] Restore error:', error)
      throw error
    }
  }

  // Purchase a package
  const purchasePackage = async (packageId: string): Promise<CustomerInfo> => {
    try {
      if (!offerings) {
        throw new Error('No offerings available')
      }

      // Find the package
      const packages = offerings.availablePackages
      const selectedPackage = packages.find(
        (pkg) => pkg.identifier === packageId,
      )

      if (!selectedPackage) {
        throw new Error(`Package ${packageId} not found`)
      }

      // Make the purchase
      const { customerInfo: info } = await Purchases.purchasePackage(
        selectedPackage,
      )
      setCustomerInfo(info)
      return info
    } catch (error) {
      console.error('[RevenueCat] Purchase error:', error)
      throw error
    }
  }

  const value: SubscriptionContextValue = {
    customerInfo,
    offerings,
    isProMember,
    isLoading,
    restorePurchases,
    purchasePackage,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider')
  }
  return context
}
