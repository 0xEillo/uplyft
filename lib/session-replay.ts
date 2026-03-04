import { Platform } from 'react-native'

const mixpanelToken = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN || ''

// Lazily required so the server/web bundle never tries to load native modules
// at import time, which would crash the eager bundle export phase.
function getSDK() {
  if (Platform.OS === 'web') return null
  try {
    return require('@mixpanel/react-native-session-replay')
  } catch {
    return null
  }
}

export async function initSessionReplay(distinctId: string): Promise<void> {
  if (!mixpanelToken || !distinctId) return
  const sdk = getSDK()
  if (!sdk) return
  try {
    const { MPSessionReplay, MPSessionReplayConfig, MPSessionReplayMask } = sdk
    const config = new MPSessionReplayConfig({
      wifiOnly: false,
      autoStartRecording: true,
      recordingSessionsPercent: 100,
      autoMaskedViews: [MPSessionReplayMask.Text, MPSessionReplayMask.Image],
      flushInterval: 10,
      enableLogging: __DEV__,
    })
    await MPSessionReplay.initialize(mixpanelToken, distinctId, config)
  } catch (error) {
    if (__DEV__) {
      console.warn('[SessionReplay] Failed to initialize:', error)
    }
  }
}

export async function identifySessionReplay(distinctId: string): Promise<void> {
  if (!distinctId) return
  const sdk = getSDK()
  if (!sdk) return
  try {
    await sdk.MPSessionReplay.identify(distinctId)
  } catch (error) {
    if (__DEV__) {
      console.warn('[SessionReplay] Failed to identify:', error)
    }
  }
}
