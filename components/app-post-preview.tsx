import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, Text, View } from 'react-native'

import type { AppPostPreviewType } from '@/data/app-posts'
import { useThemedColors } from '@/hooks/useThemedColors'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import { Image } from 'expo-image'

interface AppPostPreviewProps {
  type: AppPostPreviewType
}

const TOOLBAR_ITEMS = [
  { icon: 'camera-outline', label: 'Scan' },
  { icon: 'mic-outline', label: 'Voice' },
  { icon: 'stopwatch-outline', label: 'Timer' },
  { icon: 'albums-outline', label: 'Routines' },
  { icon: 'search-outline', label: 'Search' },
] as const

const WAVE_BARS = [8, 14, 20, 28, 18, 24, 14, 10]
const SHARE_CARDS = [
  { label: 'Volume', value: '18.4k' },
  { label: 'PRs', value: '4' },
  { label: 'Time', value: '1:02' },
]
const BODY_LOG_TREND = [8, 12, 10, 14, 16, 13, 18]
const PROGRAM_PREVIEWS = [
  {
    name: 'Push Pull Legs',
    description: '3-day classic split',
    routines: '3 routines',
    icon: 'flash-outline',
    gradient: ['#2563EB', '#3B82F6'],
  },
  {
    name: 'Full Body',
    description: 'Foundation plan',
    routines: '3 routines',
    icon: 'body-outline',
    gradient: ['#EA580C', '#F97316'],
  },
] as const

const ROUTINE_PREVIEWS = [
  { name: 'Upper Strength', imagePath: 'Upper Body A.png', tint: '#A3E635' },
  { name: 'Leg Day', imagePath: 'Legs.png', tint: '#FB923C' },
] as const

export function AppPostPreview({ type }: AppPostPreviewProps) {
  switch (type) {
    case 'editor_toolbar':
      return <EditorToolbarPreview />
    case 'workout_calendar':
      return <WorkoutCalendarPreview />
    case 'rest_timer':
      return <RestTimerPreview />
    case 'scan_workout':
      return <ScanWorkoutPreview />
    case 'voice_logging':
      return <VoiceLoggingPreview />
    case 'music_preview':
      return <MusicPreview />
    case 'pr_tooltip':
      return <PrTooltipPreview />
    case 'share_widgets':
      return <ShareWidgetsPreview />
    case 'body_log':
      return <BodyLogPreview />
    case 'routine_library':
      return <RoutineLibraryPreview />
    case 'coach_chat':
      return <CoachChatPreview />
    case 'offline_queue':
      return <OfflineQueuePreview />
    case 'explore_programs':
      return <ExploreProgramsPreview />
    case 'explore_routines':
      return <ExploreRoutinesPreview />
    default:
      return null
  }
}

function EditorToolbarPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createToolbarStyles(colors)

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
          <Text style={shared.headerTitle}>Create Post Toolbar</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>SHORTCUT</Text>
        </View>
      </View>
      <View style={styles.toolbarRow}>
        {TOOLBAR_ITEMS.map((item) => (
          <View key={item.label} style={styles.toolbarItem}>
            <View style={styles.iconBubble}>
              <Ionicons
                name={item.icon}
                size={20}
                color={colors.textPrimary}
              />
            </View>
            <Text style={styles.iconLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function WorkoutCalendarPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createCalendarStyles(colors)
  const currentDate = new Date()
  const month = currentDate.getMonth()
  const year = currentDate.getFullYear()

  const firstDay = new Date(year, month, 1)
  const startingDayOfWeek = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = currentDate.getDate()

  const highlightDays = new Set<number>(
    [2, 6, 10, 14, 18, 22, 26].filter((day) => day <= daysInMonth),
  )

  const days: (number | null)[] = []
  for (let i = 0; i < startingDayOfWeek; i += 1) {
    days.push(null)
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(day)
  }

  const monthName = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons
            name="calendar-outline"
            size={18}
            color={colors.textPrimary}
          />
          <Text style={shared.headerTitle}>{monthName}</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>SCHEDULED</Text>
        </View>
      </View>
      <View style={styles.weekRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.daysGrid}>
        {days.map((day, index) => {
          if (!day) {
            return <View key={`empty-${index}`} style={styles.dayCell} />
          }

          const isToday = day === today
          const isHighlighted = highlightDays.has(day)

          return (
            <View key={day} style={styles.dayCell}
            >
              <View
                style={[
                  styles.dayBubble,
                  isHighlighted && styles.dayBubbleHighlighted,
                  isToday && styles.dayBubbleToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    isHighlighted && styles.dayTextHighlighted,
                    isToday && styles.dayTextToday,
                  ]}
                >
                  {day}
                </Text>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function RestTimerPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createRestTimerStyles(colors)

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons
            name="stopwatch-outline"
            size={18}
            color={colors.textPrimary}
          />
          <Text style={shared.headerTitle}>Rest Timer</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>FLOW</Text>
        </View>
      </View>
      <View style={styles.timerCard}>
        <View>
          <Text style={styles.timerLabel}>Resting</Text>
          <Text style={styles.timerValue}>1:30</Text>
        </View>
        <View style={styles.timerActions}>
          <View style={styles.timerButton}>
            <Ionicons name="play" size={16} color={colors.textPrimary} />
          </View>
          <View style={styles.timerButtonPrimary}>
            <Text style={styles.timerButtonText}>+30s</Text>
          </View>
          <View style={styles.timerButton}>
            <Ionicons name="stop" size={16} color={colors.textPrimary} />
          </View>
        </View>
      </View>
    </View>
  )
}

function ScanWorkoutPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createScanStyles(colors)

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons name="camera-outline" size={18} color={colors.textPrimary} />
          <Text style={shared.headerTitle}>Scan Workout Notes</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>AI SCAN</Text>
        </View>
      </View>
      <View style={styles.scanFrame}>
        <View style={styles.scanHeader}>
          <Ionicons name="scan-outline" size={18} color={colors.brandPrimary} />
          <Text style={styles.scanText}>Align notes inside the frame</Text>
        </View>
        <View style={styles.scanLine} />
        <View style={styles.scanLineShort} />
      </View>
    </View>
  )
}

function VoiceLoggingPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createVoiceStyles(colors)

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons name="mic-outline" size={18} color={colors.textPrimary} />
          <Text style={shared.headerTitle}>Voice Logging</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>HANDS-FREE</Text>
        </View>
      </View>
      <View style={styles.voiceCard}>
        <View style={styles.waveRow}>
          {WAVE_BARS.map((height, index) => (
            <View
              key={`wave-${index}`}
              style={[styles.waveBar, { height }]}
            />
          ))}
        </View>
        <View style={styles.voiceFooter}>
          <Ionicons name="radio" size={16} color={colors.brandPrimary} />
          <Text style={styles.voiceText}>Listening for your sets...</Text>
        </View>
      </View>
    </View>
  )
}

function MusicPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createMusicStyles(colors)

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons
            name="musical-notes-outline"
            size={18}
            color={colors.textPrimary}
          />
          <Text style={shared.headerTitle}>Workout Song Preview</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>NEW</Text>
        </View>
      </View>
      <View style={styles.searchRow}>
        <Text style={styles.searchPlaceholder}>Search for a song</Text>
        <Ionicons name="search" size={16} color={colors.textSecondary} />
      </View>
      <View style={styles.resultRow}>
        <View style={styles.artwork} />
        <View style={styles.resultInfo}>
          <Text style={styles.trackName} numberOfLines={1}>
            Power Moves
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            LDN Beats • 2:34
          </Text>
        </View>
        <View style={styles.previewButton}>
          <Ionicons name="play" size={18} color={colors.textPrimary} />
        </View>
      </View>
      <Text style={styles.attribution}>Previews courtesy of iTunes.</Text>
    </View>
  )
}

function PrTooltipPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createPrStyles(colors)

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons name="trophy-outline" size={18} color={colors.textPrimary} />
          <Text style={shared.headerTitle}>PR Breakdown</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>DETAILS</Text>
        </View>
      </View>
      <View style={styles.tooltipCard}>
        <View style={styles.tooltipHeader}>
          <Text style={styles.tooltipTitle}>Bench Press</Text>
          <Ionicons name="close" size={14} color={colors.textSecondary} />
        </View>
        <View style={styles.tooltipItem}>
          <Text style={styles.tooltipLabel}>New Record</Text>
          <Text style={styles.tooltipValue}>225 lb x 5 reps</Text>
        </View>
        <View style={styles.tooltipItemAlt}>
          <Text style={styles.tooltipLabelAlt}>Previous Record</Text>
          <Text style={styles.tooltipValueAlt}>215 lb x 5 reps</Text>
        </View>
      </View>
    </View>
  )
}

function ShareWidgetsPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createShareStyles(colors)

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons name="share-outline" size={18} color={colors.textPrimary} />
          <Text style={shared.headerTitle}>Share Cards</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>READY</Text>
        </View>
      </View>
      <View style={styles.shareGrid}>
        {SHARE_CARDS.map((card) => (
          <View key={card.label} style={styles.shareCard}>
            <Text style={styles.shareValue}>{card.value}</Text>
            <Text style={styles.shareLabel}>{card.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function BodyLogPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createBodyLogStyles(colors)

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons name="body-outline" size={18} color={colors.textPrimary} />
          <Text style={shared.headerTitle}>Body Log Trends</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>TRACK</Text>
        </View>
      </View>
      <View style={styles.bodyRow}>
        <View>
          <Text style={styles.bodyMetricLabel}>Weight</Text>
          <Text style={styles.bodyMetricValue}>176.4 lb</Text>
        </View>
        <View style={styles.trendRow}>
          {BODY_LOG_TREND.map((height, index) => (
            <View
              key={`trend-${index}`}
              style={[styles.trendBar, { height }]}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

function RoutineLibraryPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createRoutineStyles(colors)

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons name="albums-outline" size={18} color={colors.textPrimary} />
          <Text style={shared.headerTitle}>Routine Library</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>SAVED</Text>
        </View>
      </View>
      <View style={styles.routineCard}>
        <View>
          <Text style={styles.routineTitle}>Push Day</Text>
          <Text style={styles.routineSubtitle}>5 exercises · 18 sets</Text>
        </View>
        <View style={styles.routineAction}>
          <Text style={styles.routineActionText}>Start</Text>
        </View>
      </View>
      <View style={styles.routineCardAlt}>
        <View>
          <Text style={styles.routineTitle}>Lower Strength</Text>
          <Text style={styles.routineSubtitle}>4 exercises · 16 sets</Text>
        </View>
        <View style={styles.routineActionGhost}>
          <Text style={styles.routineActionGhostText}>Edit</Text>
        </View>
      </View>
    </View>
  )
}

function CoachChatPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createChatStyles(colors)

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons
            name="chatbubbles-outline"
            size={18}
            color={colors.textPrimary}
          />
          <Text style={shared.headerTitle}>Coach Chat</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>ASSIST</Text>
        </View>
      </View>
      <View style={styles.chatBubbleLeft}>
        <Text style={styles.chatLabel}>Coach</Text>
        <Text style={styles.chatText}>
          Want a 45-minute upper body session?
        </Text>
      </View>
      <View style={styles.chatBubbleRight}>
        <Text style={styles.chatTextRight}>Yes — make it strength focused.</Text>
      </View>
    </View>
  )
}

function OfflineQueuePreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createOfflineStyles(colors)

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons
            name="cloud-offline-outline"
            size={18}
            color={colors.textPrimary}
          />
          <Text style={shared.headerTitle}>Offline Queue</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>SYNC</Text>
        </View>
      </View>
      <View style={styles.queueCard}>
        <View style={styles.queueHeader}>
          <View style={styles.queueAvatar} />
          <View style={styles.queueLines}>
            <View style={styles.queueLineLong} />
            <View style={styles.queueLineShort} />
          </View>
          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeText}>Queued</Text>
          </View>
        </View>
        <View style={styles.queueBlock} />
        <View style={styles.queueBlockShort} />
      </View>
    </View>
  )
}

function ExploreProgramsPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createExploreProgramStyles()

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons name="compass-outline" size={18} color={colors.textPrimary} />
          <Text style={shared.headerTitle}>Explore Programs</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>PROGRAMS</Text>
        </View>
      </View>
      <View style={styles.programRow}>
        {PROGRAM_PREVIEWS.map((program) => (
          <View key={program.name} style={styles.programCard}>
            <LinearGradient
              colors={program.gradient as unknown as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.programGradient}
            >
              <View style={styles.programIconContainer}>
                <Ionicons name={program.icon as any} size={20} color="#FFF" />
              </View>
              <View style={styles.programContent}>
                <Text style={styles.programTitle} numberOfLines={2}>
                  {program.name}
                </Text>
                <Text style={styles.programSubtitle} numberOfLines={1}>
                  {program.description}
                </Text>
                <View style={styles.programFooter}>
                  <Text style={styles.programCount}>{program.routines}</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color="rgba(255,255,255,0.8)"
                  />
                </View>
              </View>
            </LinearGradient>
          </View>
        ))}
      </View>
    </View>
  )
}

function ExploreRoutinesPreview() {
  const colors = useThemedColors()
  const shared = createSharedStyles(colors)
  const styles = createExploreRoutineStyles()

  return (
    <View style={shared.previewCard}>
      <View style={shared.headerRow}>
        <View style={shared.headerTitleRow}>
          <Ionicons name="grid-outline" size={18} color={colors.textPrimary} />
          <Text style={shared.headerTitle}>Explore Routines</Text>
        </View>
        <View style={shared.headerBadge}>
          <Text style={shared.headerBadgeText}>ROUTINES</Text>
        </View>
      </View>
      <View style={styles.routinesRow}>
        {ROUTINE_PREVIEWS.map((routine) => (
          <View key={routine.name} style={styles.routineCard}>
            <Image
              source={getRoutineImageUrl(routine.imagePath)}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={StyleSheet.absoluteFillObject}
            />
            <View
              style={[
                styles.routineTint,
                { backgroundColor: routine.tint, opacity: 0.25 },
              ]}
            />
            <View style={styles.routineContent}>
              <Text style={styles.routineTitle} numberOfLines={2}>
                {routine.name}
              </Text>
              <View style={styles.premiumContainer}>
                <Text style={[styles.premiumText, { color: routine.tint }]}>
                  Pro
                </Text>
                <Ionicons name="star" size={12} color={routine.tint} />
              </View>
            </View>
            <View style={styles.saveButton}>
              <Ionicons name="add" size={16} color="#FFF" />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function createSharedStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    previewCard: {
      marginTop: 14,
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerBadge: {
      backgroundColor: colors.brandPrimarySoft,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    headerBadgeText: {
      color: colors.brandPrimary,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.4,
    },
  })
}

function createToolbarStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    toolbarRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    toolbarItem: {
      alignItems: 'center',
      width: 58,
    },
    iconBubble: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    iconLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  })
}

function createCalendarStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    weekRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
      paddingHorizontal: 4,
    },
    weekday: {
      width: '14.285%',
      textAlign: 'center',
      fontSize: 10,
      color: colors.textTertiary,
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: '14.285%',
      alignItems: 'center',
      marginBottom: 6,
    },
    dayBubble: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayBubbleHighlighted: {
      backgroundColor: colors.brandPrimary,
    },
    dayBubbleToday: {
      borderWidth: 1,
      borderColor: colors.brandPrimary,
    },
    dayText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    dayTextHighlighted: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
    dayTextToday: {
      color: colors.brandPrimary,
      fontWeight: '700',
    },
  })
}

function createRestTimerStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    timerCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    timerLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    timerValue: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 2,
    },
    timerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    timerButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timerButtonPrimary: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: colors.brandPrimary,
    },
    timerButtonText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
  })
}

function createScanStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    scanFrame: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 18,
      backgroundColor: colors.surfaceSubtle,
      gap: 10,
    },
    scanHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    scanText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    scanLine: {
      height: 8,
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    scanLineShort: {
      height: 8,
      width: '70%',
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
  })
}

function createMusicStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      marginBottom: 12,
    },
    searchPlaceholder: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      padding: 10,
    },
    artwork: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    resultInfo: {
      flex: 1,
      gap: 4,
    },
    trackName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    artistName: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    previewButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attribution: {
      marginTop: 8,
      fontSize: 10,
      color: colors.textTertiary,
    },
  })
}

function createVoiceStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    voiceCard: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    waveRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    waveBar: {
      width: 6,
      borderRadius: 4,
      backgroundColor: colors.brandPrimary,
      opacity: 0.8,
    },
    voiceFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    voiceText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  })
}

function createPrStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    tooltipCard: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    tooltipHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    tooltipTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    tooltipItem: {
      backgroundColor: colors.surface,
      padding: 10,
      borderRadius: 10,
      gap: 4,
    },
    tooltipItemAlt: {
      backgroundColor: colors.bg,
      padding: 10,
      borderRadius: 10,
      gap: 4,
    },
    tooltipLabel: {
      fontSize: 11,
      color: colors.statusSuccess,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    tooltipLabelAlt: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    tooltipValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    tooltipValueAlt: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  })
}

function createShareStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    shareGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    shareCard: {
      flex: 1,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      gap: 6,
    },
    shareValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    shareLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  })
}

function createBodyLogStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    bodyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    bodyMetricLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    bodyMetricValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 4,
    },
    trendRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
    },
    trendBar: {
      width: 6,
      borderRadius: 4,
      backgroundColor: colors.brandPrimary,
      opacity: 0.8,
    },
  })
}

function createRoutineStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    routineCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 10,
    },
    routineCardAlt: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    routineTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    routineSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
    },
    routineAction: {
      backgroundColor: colors.brandPrimary,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    routineActionText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    routineActionGhost: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    routineActionGhostText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
  })
}

function createChatStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    chatBubbleLeft: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      maxWidth: '85%',
      marginBottom: 10,
    },
    chatBubbleRight: {
      alignSelf: 'flex-end',
      backgroundColor: colors.brandPrimary,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      maxWidth: '85%',
    },
    chatLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    chatText: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    chatTextRight: {
      fontSize: 13,
      color: colors.onPrimary,
    },
  })
}

function createOfflineStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    queueCard: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    queueHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    queueAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    queueLines: {
      flex: 1,
      gap: 6,
    },
    queueLineLong: {
      height: 8,
      borderRadius: 6,
      backgroundColor: colors.surface,
      width: '70%',
    },
    queueLineShort: {
      height: 8,
      borderRadius: 6,
      backgroundColor: colors.surface,
      width: '45%',
    },
    queueBadge: {
      backgroundColor: colors.bg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    queueBadgeText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    queueBlock: {
      height: 10,
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    queueBlockShort: {
      height: 10,
      borderRadius: 6,
      width: '75%',
      backgroundColor: colors.surface,
    },
  })
}

function createExploreProgramStyles() {
  return StyleSheet.create({
    programRow: {
      flexDirection: 'row',
      gap: 12,
    },
    programCard: {
      flex: 1,
      height: 130,
      borderRadius: 16,
      overflow: 'hidden',
    },
    programGradient: {
      flex: 1,
      padding: 14,
      justifyContent: 'space-between',
    },
    programIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    programContent: {
      gap: 4,
    },
    programTitle: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '800',
      fontStyle: 'italic',
    },
    programSubtitle: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 11,
      fontWeight: '500',
    },
    programFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    programCount: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 10,
      fontWeight: '600',
    },
  })
}

function createExploreRoutineStyles() {
  return StyleSheet.create({
    routinesRow: {
      flexDirection: 'row',
      gap: 12,
    },
    routineCard: {
      flex: 1,
      height: 170,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: '#111827',
    },
    routineTint: {
      ...StyleSheet.absoluteFillObject,
    },
    routineContent: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: 12,
      paddingBottom: 16,
    },
    routineTitle: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
      letterSpacing: -0.4,
    },
    premiumContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    premiumText: {
      fontSize: 11,
      fontWeight: '700',
    },
    saveButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
  })
}
