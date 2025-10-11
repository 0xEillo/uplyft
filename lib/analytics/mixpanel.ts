import Constants from 'expo-constants'
import { Mixpanel } from 'mixpanel-react-native'
import { Platform } from 'react-native'

type MixpanelEventName =
  | 'App Open'
  | 'Auth Sign Up'
  | 'Auth Login'
  | 'Auth Logout'
  | 'Onboarding Step Viewed'
  | 'Onboarding Completed'
  | 'Feed Viewed'
  | 'Workout Create Started'
  | 'Workout Create Saved'
  | 'Workout Create Submitted'
  | 'Explore Viewed'

export type MixpanelEventPayload = Record<string, unknown>

type IdentifyPayload = {
  email?: string
  name?: string
  goal?: string | null
  unit_system?: string
}

type SuperProperties = {
  appVersion?: string
  appBuild?: string
  platform: string
  platformVersion: string
  deviceYearClass?: number
  theme?: 'light' | 'dark'
  unitSystem?: string
}

let mixpanelInstance: Mixpanel | null = null
let initPromise: Promise<Mixpanel | null> | null = null
let pendingIdentify: {
  distinctId: string
  payload?: IdentifyPayload
} | null = null
let isDisabled = false

const getEnvBool = (value?: string) =>
  value === 'true' || value === '1' || value === 'yes'

const getToken = () => {
  const token = Constants.expoConfig?.extra?.mixpanelToken as string | undefined
  if (!token) {
    console.warn('[mixpanel] Missing token. Analytics disabled.')
    return null
  }
  return token
}

async function ensureInstance(): Promise<Mixpanel | null> {
  if (isDisabled) return null
  if (mixpanelInstance) return mixpanelInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    const token = getToken()
    if (!token) {
      isDisabled = true
      return null
    }

    const instance = new Mixpanel(token, true)
    const debugFlag = getEnvBool(
      (Constants.expoConfig?.extra?.mixpanelDebug as string | undefined) ||
        process.env.MIXPANEL_DEBUG,
    )

    if (debugFlag) {
      instance.setLoggingEnabled(true)
      console.info('[mixpanel] Debug logging enabled')
    }

    await instance.init()
    mixpanelInstance = instance

    if (pendingIdentify) {
      const { distinctId, payload } = pendingIdentify
      await identify(distinctId, payload)
      pendingIdentify = null
    }

    return instance
  })()

  return initPromise
}

export async function identify(distinctId: string, payload?: IdentifyPayload) {
  const instance = await ensureInstance()
  if (!instance) {
    pendingIdentify = { distinctId, payload }
    return
  }

  await instance.identify(distinctId)
  if (payload && Object.keys(payload).length > 0) {
    await instance.getPeople().set(payload as Record<string, unknown>)
  }
}

export async function alias(aliasId: string, distinctId?: string) {
  const instance = await ensureInstance()
  if (!instance) return

  if (!distinctId) {
    console.warn('[mixpanel] alias called without distinctId; skipping')
    return
  }

  await instance.alias(aliasId, distinctId)
}

export async function reset() {
  const instance = await ensureInstance()
  if (!instance) return

  await instance.reset()
}

export async function track(
  event: MixpanelEventName,
  payload?: MixpanelEventPayload,
) {
  const instance = await ensureInstance()
  if (!instance) return

  await instance.track(event, payload)
}

export async function registerSuperProperties(props: SuperProperties) {
  const instance = await ensureInstance()
  if (!instance) return

  await instance.registerSuperProperties(props)
}

export async function clearSuperProperties() {
  const instance = await ensureInstance()
  if (!instance) return

  await instance.unregisterSuperProperty('theme')
  await instance.unregisterSuperProperty('unitSystem')
}

export async function flush() {
  const instance = await ensureInstance()
  if (!instance) return

  await instance.flush()
}

export const MixpanelEvents: Record<MixpanelEventName, MixpanelEventName> = {
  'App Open': 'App Open',
  'Auth Sign Up': 'Auth Sign Up',
  'Auth Login': 'Auth Login',
  'Auth Logout': 'Auth Logout',
  'Onboarding Step Viewed': 'Onboarding Step Viewed',
  'Onboarding Completed': 'Onboarding Completed',
  'Feed Viewed': 'Feed Viewed',
  'Workout Create Started': 'Workout Create Started',
  'Workout Create Saved': 'Workout Create Saved',
  'Workout Create Submitted': 'Workout Create Submitted',
  'Explore Viewed': 'Explore Viewed',
}

export function guessPlatform(): string {
  if (Platform.OS === 'ios') return 'iOS'
  if (Platform.OS === 'android') return 'Android'
  if (Platform.OS === 'web') return 'Web'
  return 'Unknown'
}

export async function withMixpanel<T>(fn: (instance: Mixpanel) => Promise<T>) {
  const instance = await ensureInstance()
  if (!instance) {
    throw new Error('Mixpanel not initialized')
  }
  return fn(instance)
}
