import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { NATIVE_SHEET_LAYOUT } from '@/constants/native-sheet-layout'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { setPendingChatAttachment } from '@/lib/chat-attachment-handoff'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { Image as ExpoImage } from 'expo-image'
import * as MediaLibrary from 'expo-media-library'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface RecentPhoto {
  id: string
  uri: string
}

const MAX_SELECTABLE = 3

export default function ChatAttachmentScreen() {
  const router = useRouter()
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [recentPhotos, setRecentPhotos] = useState<RecentPhoto[]>([])
  const [selectedUris, setSelectedUris] = useState<string[]>([])
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    const fetchPhotos = async () => {
      if (hasFetchedRef.current) return
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') return
      hasFetchedRef.current = true
      const assets = await MediaLibrary.getAssetsAsync({
        first: 24,
        mediaType: 'photo',
        sortBy: [MediaLibrary.SortBy.creationTime],
      })
      setRecentPhotos(assets.assets.map((a) => ({ id: a.id, uri: a.uri })))
    }
    fetchPhotos()
  }, [])

  const dispatch = async (
    action: Parameters<typeof setPendingChatAttachment>[0],
  ) => {
    haptic('light')
    await setPendingChatAttachment(action)
    router.back()
  }

  const togglePhoto = (uri: string) => {
    haptic('light')
    setSelectedUris((prev) => {
      if (prev.includes(uri)) return prev.filter((u) => u !== uri)
      if (prev.length >= MAX_SELECTABLE) return prev
      return [...prev, uri]
    })
  }

  const confirmSelection = () => {
    if (selectedUris.length === 0) return
    dispatch({ action: 'photos_selected', uris: selectedUris })
  }

  const PHOTO_SIZE = 88
  const PHOTO_GAP = 3
  const CORNER_RADIUS = 10

  const actions = [
    {
      id: 'generate-workout',
      icon: 'flash-outline' as const,
      label: 'Generate Workout',
      subtitle: 'Create a custom workout plan',
      onPress: () => dispatch({ action: 'generate_workout' }),
    },
    {
      id: 'scan-food',
      icon: 'scan-outline' as const,
      label: 'Scan Food',
      subtitle: 'Identify food with camera',
      onPress: () => dispatch({ action: 'scan_food' }),
    },
  ]

  const content = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: NATIVE_SHEET_LAYOUT.horizontalPadding,
        paddingTop: NATIVE_SHEET_LAYOUT.topPadding,
        paddingBottom:
          insets.bottom + NATIVE_SHEET_LAYOUT.bottomSafeAreaPadding,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Title + All Photos / Send button */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => dispatch({ action: 'launch_library' })}
          hitSlop={8}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '500',
              color: colors.brandPrimary,
            }}
          >
            All Photos
          </Text>
        </TouchableOpacity>

        {selectedUris.length > 0 && (
          <TouchableOpacity onPress={confirmSelection} hitSlop={8}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: colors.brandPrimary,
              }}
            >
              Add {selectedUris.length} Photo
              {selectedUris.length > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Photo strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: PHOTO_GAP, paddingBottom: 2 }}
        style={{ flexShrink: 0, marginBottom: 24 }}
      >
        {/* Camera tile */}
        <TouchableOpacity
          onPress={() => dispatch({ action: 'launch_camera' })}
          style={{
            width: PHOTO_SIZE,
            height: PHOTO_SIZE,
            borderRadius: CORNER_RADIUS,
            backgroundColor: colors.surfaceSubtle,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="camera" size={28} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Recent photos */}
        {recentPhotos.map((photo) => {
          const isSelected = selectedUris.includes(photo.uri)
          const selectionIndex = selectedUris.indexOf(photo.uri)
          const atLimit =
            selectedUris.length >= MAX_SELECTABLE && !isSelected

          return (
            <TouchableOpacity
              key={photo.id}
              onPress={() => togglePhoto(photo.uri)}
              disabled={atLimit}
              style={{
                width: PHOTO_SIZE,
                height: PHOTO_SIZE,
                borderRadius: CORNER_RADIUS,
                overflow: 'hidden',
                opacity: atLimit ? 0.4 : 1,
              }}
            >
              <ExpoImage
                source={{ uri: photo.uri }}
                style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }}
                contentFit="cover"
              />
              {isSelected && (
                <View
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    backgroundColor: 'rgba(0,0,0,0.25)',
                  }}
                />
              )}
              {/* Selection badge */}
              <View
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: isSelected
                    ? colors.brandPrimary
                    : 'rgba(0,0,0,0.35)',
                  borderWidth: isSelected ? 0 : 1.5,
                  borderColor: 'rgba(255,255,255,0.8)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isSelected && (
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: '700',
                      lineHeight: 13,
                    }}
                  >
                    {selectionIndex + 1}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Action rows */}
      {actions.map((action) => (
        <TouchableOpacity
          key={action.id}
          onPress={action.onPress}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
          }}
        >
          <Ionicons
            name={action.icon}
            size={22}
            color={colors.textPrimary}
            style={{ marginRight: 14 }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '500',
                color: colors.textPrimary,
                lineHeight: 21,
              }}
            >
              {action.label}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textTertiary,
                lineHeight: 18,
              }}
            >
              {action.subtitle}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )

  return (
    <View
      collapsable={false}
      style={{ flex: 1, backgroundColor: 'transparent' }}
    >
      <LiquidGlassSurface
        style={StyleSheet.absoluteFill}
        fallbackStyle={{
          backgroundColor: isDark
            ? 'rgba(28,28,30,0.82)'
            : 'rgba(242,242,247,0.82)',
        }}
      />
      {content}
    </View>
  )
}
