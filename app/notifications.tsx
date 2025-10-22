import { useThemedColors } from '@/hooks/useThemedColors'
import { useNotifications } from '@/contexts/notification-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function NotificationsScreen() {
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const { unreadCount, markAsRead } = useNotifications()

  // Mark notifications as read when screen is viewed
  useEffect(() => {
    if (unreadCount > 0) {
      markAsRead()
    }
  }, [unreadCount, markAsRead])

  const handleBackPress = () => {
    router.back()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Empty state */}
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons
              name="notifications-outline"
              size={80}
              color={colors.border}
            />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyMessage}>
            We&apos;ll notify you when your trial is about to end
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function createStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    placeholder: {
      width: 24,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIconContainer: {
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
  })
}
