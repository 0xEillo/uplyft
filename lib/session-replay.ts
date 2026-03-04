import {
  MPSessionReplay,
  MPSessionReplayConfig,
  MPSessionReplayMask,
} from '@mixpanel/react-native-session-replay'

const mixpanelToken = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN || ''

const config = new MPSessionReplayConfig({
  wifiOnly: false,
  autoStartRecording: true,
  recordingSessionsPercent: 100,
  autoMaskedViews: [MPSessionReplayMask.Text, MPSessionReplayMask.Image],
  flushInterval: 10,
  enableLogging: __DEV__,
})

export async function initSessionReplay(distinctId: string): Promise<void> {
  if (!mixpanelToken || !distinctId) return
  try {
    await MPSessionReplay.initialize(mixpanelToken, distinctId, config)
  } catch (error) {
    if (__DEV__) {
      console.warn('[SessionReplay] Failed to initialize:', error)
    }
  }
}

export async function identifySessionReplay(distinctId: string): Promise<void> {
  if (!distinctId) return
  try {
    await MPSessionReplay.identify(distinctId)
  } catch (error) {
    if (__DEV__) {
      console.warn('[SessionReplay] Failed to identify:', error)
    }
  }
}
