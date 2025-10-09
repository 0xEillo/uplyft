import AsyncStorage from '@react-native-async-storage/async-storage'
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import { Platform } from 'react-native'
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
} from 'react-native-purchases'
import { useAuth } from './auth-context'

interface SubscriptionContextType {
  isSubscribed: boolean
  isLoading: boolean
  isInTrial: boolean
  trialDaysRemaining: number
  canLogWorkout: boolean
  showPaywall: () => void
  hidePaywall: () => void
  isPaywallVisible: boolean
  offerings: PurchasesOffering | null
  purchasePackage: (packageToPurchase: any) => Promise<void>
  restorePurchases: () => Promise<void>
  refreshSubscriptionStatus: () => Promise<void>
  startTrial: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
)

// RevenueCat API Keys - these should be in environment variables in production
const REVENUECAT_IOS_API_KEY = 'your_ios_api_key_here'
const REVENUECAT_ANDROID_API_KEY = 'your_android_api_key_here'

const TRIAL_START_KEY = '@trial_start_date'
const TRIAL_DURATION_DAYS = 3

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isInTrial, setIsInTrial] = useState(false)
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0)
  const [isPaywallVisible, setIsPaywallVisible] = useState(false)
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null)

  // Initialize RevenueCat
  useEffect(() => {
    const initializePurchases = async () => {
      if (Platform.OS === 'web') {
        // RevenueCat doesn't work on web
        setIsLoading(false)
        return
      }

      try {
        // Configure Purchases
        Purchases.setLogLevel(LOG_LEVEL.DEBUG)

        const apiKey =
          Platform.OS === 'ios'
            ? REVENUECAT_IOS_API_KEY
            : REVENUECAT_ANDROID_API_KEY

        await Purchases.configure({
          apiKey,
          appUserID: user?.id,
        })

        // Fetch customer info and offerings
        await refreshSubscriptionStatus()
        await fetchOfferings()
      } catch (error) {
        console.error('Error initializing RevenueCat:', error)
        setIsLoading(false)
      }
    }

    if (user) {
      initializePurchases()
    } else {
      setIsLoading(false)
    }
  }, [user])

  // Check trial status
  useEffect(() => {
    const checkTrialStatus = async () => {
      if (!user) {
        setIsInTrial(false)
        setTrialDaysRemaining(0)
        return
      }

      try {
        const trialStartStr = await AsyncStorage.getItem(TRIAL_START_KEY)
        if (!trialStartStr) {
          setIsInTrial(false)
          setTrialDaysRemaining(0)
          return
        }

        const trialStartDate = new Date(trialStartStr)
        const now = new Date()
        const daysPassed = Math.floor(
          (now.getTime() - trialStartDate.getTime()) / (1000 * 60 * 60 * 24),
        )
        const daysRemaining = Math.max(0, TRIAL_DURATION_DAYS - daysPassed)

        setIsInTrial(daysRemaining > 0)
        setTrialDaysRemaining(daysRemaining)
      } catch (error) {
        console.error('Error checking trial status:', error)
        setIsInTrial(false)
        setTrialDaysRemaining(0)
      }
    }

    checkTrialStatus()
  }, [user])

  const fetchOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings()
      if (offerings.current !== null) {
        setOfferings(offerings.current)
      }
    } catch (error) {
      console.error('Error fetching offerings:', error)
    }
  }

  const refreshSubscriptionStatus = async () => {
    if (Platform.OS === 'web') {
      setIsSubscribed(false)
      setIsLoading(false)
      return
    }

    try {
      const customerInfo: CustomerInfo = await Purchases.getCustomerInfo()

      // Check if user has an active entitlement
      // The entitlement identifier should match what you set up in RevenueCat dashboard
      const isActive =
        typeof customerInfo.entitlements.active['premium'] !== 'undefined'

      setIsSubscribed(isActive)
      setIsLoading(false)
    } catch (error) {
      console.error('Error checking subscription status:', error)
      setIsSubscribed(false)
      setIsLoading(false)
    }
  }

  const purchasePackage = async (packageToPurchase: any) => {
    if (Platform.OS === 'web') {
      throw new Error('Purchases are not supported on web')
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(
        packageToPurchase,
      )

      // Check if the purchase was successful
      const isActive =
        typeof customerInfo.entitlements.active['premium'] !== 'undefined'

      setIsSubscribed(isActive)

      if (isActive) {
        hidePaywall()
      }
    } catch (error) {
      if (!error.userCancelled) {
        console.error('Error purchasing package:', error)
        throw error
      }
    }
  }

  const restorePurchases = async () => {
    if (Platform.OS === 'web') {
      throw new Error('Restore purchases is not supported on web')
    }

    try {
      const customerInfo = await Purchases.restorePurchases()

      const isActive =
        typeof customerInfo.entitlements.active['premium'] !== 'undefined'

      setIsSubscribed(isActive)

      return customerInfo
    } catch (error) {
      console.error('Error restoring purchases:', error)
      throw error
    }
  }

  const startTrial = async () => {
    if (Platform.OS === 'web') {
      // For web, just store trial start date
      const now = new Date().toISOString()
      await AsyncStorage.setItem(TRIAL_START_KEY, now)
      setIsInTrial(true)
      setTrialDaysRemaining(TRIAL_DURATION_DAYS)
      return
    }

    try {
      // Start trial by purchasing the package with trial
      if (!offerings || !offerings.availablePackages.length) {
        throw new Error('No subscription packages available')
      }

      const trialPackage = offerings.availablePackages[0]
      await Purchases.purchasePackage(trialPackage)

      // Store trial start date locally
      const now = new Date().toISOString()
      await AsyncStorage.setItem(TRIAL_START_KEY, now)

      // Refresh subscription status
      await refreshSubscriptionStatus()

      setIsInTrial(true)
      setTrialDaysRemaining(TRIAL_DURATION_DAYS)
    } catch (error) {
      if (!error.userCancelled) {
        console.error('Error starting trial:', error)
        throw error
      }
    }
  }

  const showPaywall = () => {
    setIsPaywallVisible(true)
  }

  const hidePaywall = () => {
    setIsPaywallVisible(false)
  }

  // Determine if user can log workout
  // Users can log if: they're in trial OR they're subscribed
  const canLogWorkout = isInTrial || isSubscribed

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        isLoading,
        isInTrial,
        trialDaysRemaining,
        canLogWorkout,
        showPaywall,
        hidePaywall,
        isPaywallVisible,
        offerings,
        purchasePackage,
        restorePurchases,
        refreshSubscriptionStatus,
        startTrial,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (context === undefined) {
    throw new Error(
      'useSubscription must be used within a SubscriptionProvider',
    )
  }
  return context
}
