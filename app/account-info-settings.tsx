import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function AccountInfoSettingsScreen() {
  const { user, isAnonymous } = useAuth()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const colors = useThemedColors()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const insets = useSafeAreaInsets()
  const NAVBAR_HEIGHT = 76

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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <BlurredHeader>
          <BaseNavbar
            leftContent={
              <NavbarIsland>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                  <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </NavbarIsland>
            }
            centerContent={<Text style={styles.headerTitle}>Account</Text>}
          />
        </BlurredHeader>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <BlurredHeader>
        <BaseNavbar
          leftContent={
            <NavbarIsland>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </NavbarIsland>
          }
          centerContent={<Text style={styles.headerTitle}>Account</Text>}
        />
      </BlurredHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + NAVBAR_HEIGHT },
        ]}
        scrollIndicatorInsets={{ top: insets.top + NAVBAR_HEIGHT }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View style={styles.profileCard}>
            <View style={styles.profileDetails}>
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => router.push('/edit-profile')}
                activeOpacity={0.8}
              >
                <View style={styles.detailLabelContainer}>
                  <Ionicons name="at" size={20} color={colors.textSecondary} />
                  <View>
                    <Text style={styles.detailLabel}>User Tag</Text>
                    <Text style={styles.detailDescription}>Change your @handle</Text>
                  </View>
                </View>
                <View style={styles.detailValueContainer}>
                  <Text style={styles.detailValue}>
                    @{profile?.user_tag || 'Not set'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </TouchableOpacity>

              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <View style={styles.detailLabelContainer}>
                  <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                  <View>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailDescription}>Your linked email address</Text>
                  </View>
                </View>
                {isAnonymous ? (
                  <TouchableOpacity
                    onPress={() => router.push('/(auth)/create-account')}
                    style={styles.linkAccountButton}
                  >
                    <Text style={styles.linkAccountText}>Link Account</Text>
                    <Ionicons name="add-circle" size={18} color={colors.brandPrimary} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.detailValueContainer}>
                    <Text style={styles.detailValue}>{user?.email || 'Not set'}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    section: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    profileCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    profileDetails: {
      gap: 0,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    detailLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    detailLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    detailDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    detailValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flex: 1,
      justifyContent: 'flex-end',
    },
    detailValue: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'right',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    linkAccountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    linkAccountText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
  })
