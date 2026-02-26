
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { SlideUpView } from '@/components/slide-up-view'
import { NATIVE_SHEET_LAYOUT } from '@/constants/native-sheet-layout'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function LifterLevelInfoScreen() {
  const router = useRouter()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const [shouldExit, setShouldExit] = useState(false)
  const isIOSFormSheet = Platform.OS === 'ios'

  const styles = createStyles(colors)

  const closeSheet = () => {
    if (isIOSFormSheet) {
      router.back()
      return
    }
    setShouldExit(true)
  }
  const handleExitComplete = () => router.back()

  const content = (
    <View style={styles.sectionsContainer}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How to Level Up</Text>
        <Text style={styles.sectionText}>
          The stronger you get, the more points you earn. Focus on getting stronger on major compound lifts to see your score climb the ranks.
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exercise Weighting</Text>
        <Text style={styles.sectionText}>
          Core free weight exercises (like Squats, Bench Press, and Deadlifts) are weighted heavier than machines and isolation movements.
        </Text>
      </View>
    </View>
  )

  if (isIOSFormSheet) {
    return (
      <View
        collapsable={false}
        style={[
          styles.formSheetContainer,
          {
            paddingBottom: insets.bottom + NATIVE_SHEET_LAYOUT.bottomSafeAreaPadding,
          },
        ]}
      >
        <LiquidGlassSurface style={StyleSheet.absoluteFill} />
        <View collapsable={false} style={styles.formSheetHeaderSection}>
          <Text style={styles.title}>Lifter Levels</Text>
        </View>

        <ScrollView
          style={styles.formSheetScroll}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      </View>
    )
  }

  // Non-iOS fallback
  return (
    <View style={styles.backdrop}>
      <TouchableOpacity
        style={styles.backdropPress}
        activeOpacity={1}
        onPress={closeSheet}
      />
      <SlideUpView
        style={styles.sheetWrapper}
        backgroundColor="transparent"
        shouldExit={shouldExit}
        onExitComplete={handleExitComplete}
        duration={260}
      >
        <View style={[styles.sheetContainer, { paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Lifter Levels</Text>
          </View>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {content}
          </ScrollView>
        </View>
      </SlideUpView>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    backdropPress: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    sheetWrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
    // Standard sheet container (for non-native sheets)
    sheetContainer: {
      flex: 1,
      backgroundColor: colors.surfaceSheet,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden',
      paddingHorizontal: NATIVE_SHEET_LAYOUT.horizontalPadding,
      paddingTop: NATIVE_SHEET_LAYOUT.topPadding,
      maxHeight: '60%', 
    },
    // Native form sheet container
    formSheetContainer: {
      flex: 1,
      paddingHorizontal: NATIVE_SHEET_LAYOUT.horizontalPadding,
      paddingTop: NATIVE_SHEET_LAYOUT.topPadding,
    },
    formSheetHeaderSection: {
      marginBottom: NATIVE_SHEET_LAYOUT.headerBottomSpacing,
      flexDirection: 'row',
      alignItems: 'center',
    },
    header: {
      marginBottom: NATIVE_SHEET_LAYOUT.headerBottomSpacing,
    },
    title: {
      fontSize: NATIVE_SHEET_LAYOUT.titleFontSize, // 24
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.4,
    },
    formSheetScroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: NATIVE_SHEET_LAYOUT.contentBottomSpacing,
    },
    sectionsContainer: {
      gap: 16,
    },
    section: {
      gap: 6,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    sectionText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      opacity: 0.5,
    },
  })
