import { Mixpanel } from 'mixpanel-react-native'
import 'react-native-get-random-values'

const trackAutomaticEvents = true
const mixpanelToken = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN || ''

export const mixpanel = new Mixpanel(
  mixpanelToken,
  trackAutomaticEvents,
)

// Configure Mixpanel instance
mixpanel.setServerURL('https://api-eu.mixpanel.com')
mixpanel.init()
