import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import {
    Image,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native'

import { AppPostPreview } from '@/components/app-post-preview'
import { APP_ACCOUNT, type AppPost } from '@/data/app-posts'
import { useThemedColors } from '@/hooks/useThemedColors'

interface AppPostCardProps {
  post: AppPost
  isFirst?: boolean
  onCtaPress?: (post: AppPost) => void
  onDismiss?: (post: AppPost) => void
}

export function AppPostCard({
  post,
  isFirst = false,
  onCtaPress,
  onDismiss,
}: AppPostCardProps) {
  const colors = useThemedColors()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const styles = createStyles(colors)
  const imageHeight = Math.min(420, Math.round(width * 0.56))

  const hasCta = Boolean(post.ctaRoute || post.ctaUrl)
  const shouldShowImage = Boolean(post.image) && !post.preview

  const handleCtaPress = useCallback(() => {
    onCtaPress?.(post)
    if (post.ctaRoute) {
      router.push(post.ctaRoute)
      return
    }

    if (post.ctaUrl) {
      Linking.openURL(post.ctaUrl).catch((error) => {
        console.error('Failed to open app post URL:', error)
      })
    }
  }, [onCtaPress, post, router])

  return (
    <View style={[styles.card, isFirst && { borderTopWidth: 0 }]}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image source={APP_ACCOUNT.avatar} style={styles.avatar} />
          <View style={styles.userText}>
            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {APP_ACCOUNT.name}
              </Text>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={colors.brandPrimary}
              />
            </View>
          </View>
        </View>
        {onDismiss ? (
          <TouchableOpacity
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => onDismiss(post)}
            style={styles.dismissButton}
          >
            <Ionicons
              name="close"
              size={22}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {post.title}
      </Text>
      <Text style={styles.body} numberOfLines={4}>
        {post.body}
      </Text>

      {post.preview ? <AppPostPreview type={post.preview} /> : null}

      {hasCta ? (
        <TouchableOpacity
          style={styles.cta}
          onPress={handleCtaPress}
          activeOpacity={0.7}
        >
          <Text style={styles.ctaText}>{post.ctaText || 'Read more'}</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.brandPrimary}
          />
        </TouchableOpacity>
      ) : null}

      {shouldShowImage ? (
        <View style={styles.imageWrapper}>
          <Image
            source={post.image}
            style={[styles.image, { height: imageHeight }]}
            resizeMode="cover"
          />
        </View>
      ) : null}
    </View>
  )
}

function createStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bg,
      paddingHorizontal: 14,
      paddingTop: 18,
      paddingBottom: 18,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
    },
    userText: {
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    userName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      maxWidth: 160,
    },
    dismissButton: {
      padding: 4,
    },

    badge: {
      backgroundColor: colors.brandPrimarySoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgeText: {
      color: colors.brandPrimary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    cta: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    ctaText: {
      color: colors.brandPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    imageWrapper: {
      marginTop: 14,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    image: {
      width: '100%',
    },
  })
}
