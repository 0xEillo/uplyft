import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { SlideUpView } from '@/components/slide-up-view'
import { NATIVE_SHEET_LAYOUT } from '@/constants/native-sheet-layout'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useLocalSearchParams, useRouter } from 'expo-router'
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

type InfoSectionKey = 'lifter-level' | 'level-up' | 'your-exercises'

type InfoContent = {
  title: string
  subtitle: string
  sections: Array<{ title: string; text: string }>
  nextMove: string
}

const INFO_CONTENT: Record<InfoSectionKey, InfoContent> = {
  'lifter-level': {
    title: 'Lifter Level',
    subtitle: 'Your global rank based on weighted strength across key movements.',
    sections: [
      {
        title: 'How it works',
        text: 'Your score is built from your strongest lifts, adjusted by movement weighting and balance across muscle groups.',
      },
      {
        title: 'What to optimize',
        text: 'Raise weaker weighted areas first. Balanced progress moves your level faster than over-specializing one lift.',
      },
    ],
    nextMove: 'Open the Level-Up section and target the top 1-2 exercises first.',
  },
  'level-up': {
    title: 'Level-Up Priorities',
    subtitle: 'The highest-impact exercises for increasing your total lifter score.',
    sections: [
      {
        title: 'How it works',
        text: 'Exercises are ranked by expected total score gain if you reach the next level on that movement.',
      },
      {
        title: 'What to optimize',
        text: 'Higher +pts means faster overall progress. Prioritize these picks before lower-impact accessories.',
      },
    ],
    nextMove: 'Focus on the top card until it levels up, then re-check priorities.',
  },
  'your-exercises': {
    title: 'Your Exercises',
    subtitle: 'Live progress for each tracked lift that contributes to your strength profile.',
    sections: [
      {
        title: 'How it works',
        text: 'Each card shows current exercise level and progress toward its next strength milestone.',
      },
      {
        title: 'What to optimize',
        text: 'Use this section to monitor consistency and momentum across all tracked lifts, not just your top one.',
      },
    ],
    nextMove: 'Keep logging sets regularly so each exercise card updates with fresh progression.',
  },
}

function resolveInfoSection(
  section: string | string[] | undefined,
): InfoSectionKey {
  const value = Array.isArray(section) ? section[0] : section
  if (
    value === 'lifter-level' ||
    value === 'level-up' ||
    value === 'your-exercises'
  ) {
    return value
  }
  return 'lifter-level'
}

export default function LifterLevelInfoScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ section?: string | string[] }>()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const [shouldExit, setShouldExit] = useState(false)
  const isIOSFormSheet = Platform.OS === 'ios'
  const sectionKey = resolveInfoSection(params.section)
  const info = INFO_CONTENT[sectionKey]

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
      <Text style={styles.subtitle}>{info.subtitle}</Text>
      {info.sections.map((item, index) => (
        <View key={item.title}>
          {index > 0 && <View style={styles.divider} />}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{item.title}</Text>
            <Text style={styles.sectionText}>{item.text}</Text>
          </View>
        </View>
      ))}
      <View style={styles.nextMoveCard}>
        <Text style={styles.nextMoveLabel}>Next Move</Text>
        <Text style={styles.nextMoveText}>{info.nextMove}</Text>
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
          <Text style={styles.title}>{info.title}</Text>
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
            <Text style={styles.title}>{info.title}</Text>
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
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
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
    nextMoveCard: {
      marginTop: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceCard,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    nextMoveLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      color: colors.textTertiary,
    },
    nextMoveText: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      opacity: 0.5,
    },
  })
