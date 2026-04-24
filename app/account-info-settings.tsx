import {
  SettingsCard,
  SettingsRow,
  SettingsScreen,
  SettingsSection,
} from '@/components/ui/settings'
import {
  FontSize,
  FontWeight,
  IconSize,
  Spacing,
  Typography,
} from '@/constants/theme'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function AccountInfoSettingsScreen() {
  const { user, isAnonymous } = useAuth()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const colors = useThemedColors()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      const data = await database.profiles.getByIdOrNull(user.id)
      if (data) {
        setProfile(data)
      } else if (user.email) {
        const createdData = await database.profiles.getOrCreate(
          user.id,
          user.email,
        )
        setProfile(createdData)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user?.email, user?.id])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  useEffect(() => {
    trackEvent('account_info_settings_viewed')
  }, [trackEvent])

  const styles = createStyles(colors)

  return (
    <SettingsScreen title="Account" onBack={() => router.back()} loading={isLoading}>
      <SettingsSection>
        <SettingsCard>
          <SettingsRow
            icon="at"
            title="User Tag"
            description="Change your @handle"
            onPress={() => router.push('/edit-profile')}
            rightContent={
              <View style={styles.valueRow}>
                <Text style={styles.valueText}>
                  @{profile?.user_tag || 'Not set'}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={IconSize.sm}
                  color={colors.textMuted}
                />
              </View>
            }
          />
          <SettingsRow
            icon="mail-outline"
            title="Email"
            description="Your linked email address"
            rightContent={
              isAnonymous ? (
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/create-account')}
                  style={styles.linkAccountButton}
                >
                  <Text style={styles.linkAccountText}>Link Account</Text>
                  <Ionicons
                    name="add-circle"
                    size={18}
                    color={colors.brandPrimary}
                  />
                </TouchableOpacity>
              ) : (
                <Text style={styles.valueText}>{user?.email || 'Not set'}</Text>
              )
            }
          />
        </SettingsCard>
      </SettingsSection>
    </SettingsScreen>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    valueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    valueText: {
      ...Typography.body,
      fontWeight: FontWeight.medium,
      color: colors.textSecondary,
      textAlign: 'right',
    },
    linkAccountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    linkAccountText: {
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.brandPrimary,
    },
  })
