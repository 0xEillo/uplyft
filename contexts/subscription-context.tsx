import Constants from 'expo-constants'
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

type SubscriptionContextValue = {
  customerInfo: CustomerInfo | null
  offerings: PurchasesOffering | null
  isProMember: boolean
  isLoading: boolean
  restorePurchases: () => Promise<void>
  purchasePackage: (packageId: string) => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(
  undefined,
)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Configure RevenueCat SDK once on mount
  useEffect(() => {
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
        Purchases.setLogLevel(LOG_LEVEL.DEBUG)

        // Debug: Log what we're loading
        console.log('[RevenueCat] Platform:', Platform.OS)
        console.log(
          '[RevenueCat] Constants.expoConfig?.extra:',
          Constants.expoConfig?.extra,
        )

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

        // Debug: Log API key info (masked for security)
        console.log(
          '[RevenueCat] Test Store Key loaded:',
          testStoreKey ? `${testStoreKey.substring(0, 10)}...` : 'MISSING',
        )
        console.log(
          '[RevenueCat] Apple API Key loaded:',
          appleApiKey ? `${appleApiKey.substring(0, 10)}...` : 'MISSING',
        )
        console.log(
          '[RevenueCat] Google API Key loaded:',
          googleApiKey ? `${googleApiKey.substring(0, 10)}...` : 'MISSING',
        )

        console.log(
          '[RevenueCat] Using test store? ',
          shouldUseTestStore ? 'YES' : 'NO',
        )

        // Prioritize Test Store key for testing
        let apiKeyToUse: string | undefined
        if (shouldUseTestStore && testStoreKey) {
          apiKeyToUse = testStoreKey
          console.log('[RevenueCat] Using Test Store key for testing')
        } else if (Platform.OS === 'ios' && appleApiKey) {
          apiKeyToUse = appleApiKey
          console.log('[RevenueCat] Using Apple key for production')
        } else if (Platform.OS === 'android' && googleApiKey) {
          apiKeyToUse = googleApiKey
          console.log('[RevenueCat] Using Google key for production')
        }

        // Validate API key exists
        if (!apiKeyToUse) {
          console.warn('[RevenueCat] No API key configured')
          setIsLoading(false)
          return
        }

        // Configure SDK once (do NOT reconfigure on user changes)
        await Purchases.configure({ apiKey: apiKeyToUse })
        console.log('[RevenueCat] SDK configured successfully')

        // Fetch initial customer info and offerings
        const [info, currentOfferings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ])

        setCustomerInfo(info)
        setOfferings(currentOfferings.current)
        console.log('[RevenueCat] Initial data loaded')
      } catch (error) {
        console.error('[RevenueCat] Configuration error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    configureRevenueCat()
  }, []) // Only run once on mount

  // Handle user login separately
  useEffect(() => {
    if (isLoading) {
      return
    }

    const syncRevenueCatUser = async () => {
      try {
        if (user?.id) {
          console.log('[RevenueCat] Logging in user:', user.id)
          const { customerInfo: info } = await Purchases.logIn(user.id)
          setCustomerInfo(info)
          console.log('[RevenueCat] User logged in successfully')
          console.log(
            '[RevenueCat] Active entitlements:',
            Object.keys(info.entitlements.active),
          )
        } else {
          console.log(
            '[RevenueCat] No authenticated user detected. Logging out of RevenueCat.',
          )
          const info = await Purchases.logOut()
          setCustomerInfo(info)
          console.log('[RevenueCat] RevenueCat user reset to anonymous')
        }
      } catch (error) {
        console.error('[RevenueCat] User sync error:', error)
      }
    }

    syncRevenueCatUser()
  }, [user?.id, isLoading]) // Run when user ID changes or initialization completes

  // Check if user has Pro entitlement (case-sensitive: must match RevenueCat dashboard)
  const isProMember =
    customerInfo?.entitlements.active['Pro'] !== undefined || false

  // Restore purchases
  const restorePurchases = async () => {
    try {
      const info = await Purchases.restorePurchases()
      setCustomerInfo(info)
    } catch (error) {
      console.error('[RevenueCat] Restore error:', error)
      throw error
    }
  }

  // Purchase a package
  const purchasePackage = async (packageId: string) => {
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
