import { useAuth } from '@/contexts/auth-context'
import { parseInvitePayload } from '@/lib/app-links'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

export default function InviteEntryScreen() {
  const params = useLocalSearchParams<{
    inviterId?: string | string[]
    inviter_id?: string | string[]
    inviterTag?: string | string[]
    inviter_tag?: string | string[]
    inviterName?: string | string[]
    inviter_name?: string | string[]
    referrerId?: string | string[]
    referrer_id?: string | string[]
    ref?: string | string[]
  }>()
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const invitePayload = parseInvitePayload(params)
    if (!invitePayload?.inviterId) {
      router.replace(user ? '/(tabs)' : '/(auth)/welcome')
      return
    }

    router.replace({
      pathname: '/invite/[inviteId]',
      params: {
        inviteId: invitePayload.inviterId,
      },
    })
  }, [isLoading, params, router, user])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" />
      <Text style={styles.text}>Opening invite...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: {
    fontSize: 14,
    color: '#6B7280',
  },
})
