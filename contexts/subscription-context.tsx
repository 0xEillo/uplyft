import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
} from 'react-native-purchases'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
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

  // Initialize RevenueCat
  useEffect(() => {
    const initRevenueCat = async () => {
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
        console.log('[RevenueCat] Constants.expoConfig?.extra:', Constants.expoConfig?.extra)

        // Get API keys from config
        const appleApiKey = Constants.expoConfig?.extra
          ?.revenueCatAppleApiKey as string | undefined
        const googleApiKey = Constants.expoConfig?.extra
          ?.revenueCatGoogleApiKey as string | undefined

        // Debug: Log API key info (masked for security)
        console.log('[RevenueCat] Apple API Key loaded:', appleApiKey ? `${appleApiKey.substring(0, 10)}...` : 'MISSING')
        console.log('[RevenueCat] Google API Key loaded:', googleApiKey ? `${googleApiKey.substring(0, 10)}...` : 'MISSING')

        // Validate API key exists
        if (Platform.OS === 'ios' && !appleApiKey) {
          console.warn('[RevenueCat] No Apple API key configured')
          setIsLoading(false)
          return
        }
        if (Platform.OS === 'android' && !googleApiKey) {
          console.warn('[RevenueCat] No Google API key configured')
          setIsLoading(false)
          return
        }

        // Configure for the appropriate platform
        if (Platform.OS === 'ios' && appleApiKey) {
          console.log('[RevenueCat] Configuring with Apple key')
          await Purchases.configure({ apiKey: appleApiKey })
        } else if (Platform.OS === 'android' && googleApiKey) {
          console.log('[RevenueCat] Configuring with Google key')
          await Purchases.configure({ apiKey: googleApiKey })
        }

        console.log('[RevenueCat] SDK configured successfully')

        // Set user ID if available
        if (user?.id) {
          await Purchases.logIn(user.id)
          console.log('[RevenueCat] User logged in:', user.id)
        }

        // Fetch initial customer info and offerings
        const [info, currentOfferings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ])

        setCustomerInfo(info)
        setOfferings(currentOfferings.current)
        console.log('[RevenueCat] Initialization complete')
      } catch (error) {
        console.error('[RevenueCat] Initialization error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initRevenueCat()
  }, [user?.id])

  // Check if user has Pro entitlement
  const isProMember =
    customerInfo?.entitlements.active['pro'] !== undefined || false

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
      const selectedPackage = packages.find((pkg) => pkg.identifier === packageId)

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
