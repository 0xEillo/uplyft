import { Mixpanel } from 'mixpanel-react-native'
import 'react-native-get-random-values'

const mixpanelToken = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN || ''

export const mixpanel = new Mixpanel(mixpanelToken, false, true)

mixpanel.init(false, undefined, 'https://api-eu.mixpanel.com')
