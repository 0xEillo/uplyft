import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { buildSmoothPath } from '@/lib/chart-paths'
import { haptic } from '@/lib/haptics'
import { estimateOneRepMaxKg } from '@/lib/strength-progress'
import { useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Line as SvgLine,
} from 'react-native-svg'

export interface ExerciseProgressSession {
  date: string
  sets: {
    weight: number | null
    reps: number | null
    is_warmup: boolean
  }[]
}

export type ProgressRange = '3M' | '6M' | '1Y' | 'ALL'

export const PROGRESS_RANGES: ProgressRange[] = ['3M', '6M', '1Y', 'ALL']

export const PROGRESS_RANGE_LABELS: Record<ProgressRange, string> = {
  '3M': 'Last 3 months',
  '6M': 'Last 6 months',
  '1Y': 'Last year',
  ALL: 'All time',
}

const RANGE_DAYS: Record<ProgressRange, number | null> = {
  '3M': 91,
  '6M': 182,
  '1Y': 365,
  ALL: null,
}

const DAY_MS = 24 * 60 * 60 * 1000

interface ExerciseProgressTabProps {
  /** Workout sessions for this exercise, newest first. */
  sessions: ExerciseProgressSession[]
  isRepBased: boolean
  range: ProgressRange
}

type ChartKind = 'line' | 'bar'

interface MetricPoint {
  date: Date
  value: number
}

interface MetricConfig {
  key: string
  title: string
  kind: ChartKind
  unit: 'weight' | 'reps'
  points: MetricPoint[]
  /** Value from the most recent workout in range. */
  latest: number
  /** First and last workout in range, for the axis and change labels. */
  firstDate: Date | null
  lastDate: Date | null
}

const CHART_HEIGHT = 150
const GRID_LINES = 4
// Above this many points, only the latest point gets a dot.
const MAX_DOTTED_POINTS = 12
// Shown behind the empty state, like a preview of what the chart will become.
const PLACEHOLDER_VALUES = [2, 3.2, 3.8, 3.1, 4.4, 5.6, 4.6]

/**
 * Bar charts group workouts over longer ranges so the bars stay readable: one
 * bar per workout up to 3 months, then per week, per two weeks and per month.
 * Line charts always plot every workout.
 */
function bucketDaysForSpan(spanDays: number): number {
  if (spanDays <= 91) return 0
  if (spanDays <= 182) return 7
  if (spanDays <= 365) return 14
  return 30
}

function buildMetrics(
  sessions: ExerciseProgressSession[],
  isRepBased: boolean,
  range: ProgressRange,
): MetricConfig[] {
  const rangeDays = RANGE_DAYS[range]
  const cutoff = rangeDays === null ? null : Date.now() - rangeDays * DAY_MS
  const chronological = [...sessions]
    .map((session) => ({
      date: new Date(session.date),
      sets: session.sets.filter(
        (set) => !set.is_warmup && (set.reps ?? 0) > 0,
      ),
    }))
    .filter(
      (session) =>
        session.sets.length > 0 &&
        Number.isFinite(session.date.getTime()) &&
        (cutoff === null || session.date.getTime() >= cutoff),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const firstTime = chronological[0]?.date.getTime() ?? 0
  const lastTime = chronological[chronological.length - 1]?.date.getTime() ?? 0
  const bucketDays = bucketDaysForSpan(
    rangeDays ?? (lastTime - firstTime) / DAY_MS,
  )

  // Grouped bars show the average workout in each group, dated at its last
  // workout, so a busy week doesn't look like a bigger one.
  const collect = (
    pick: (sets: ExerciseProgressSession['sets']) => number,
    grouped: boolean,
  ): Pick<MetricConfig, 'points' | 'latest' | 'firstDate' | 'lastDate'> => {
    const points: MetricPoint[] = []
    const sums: { total: number; count: number }[] = []
    let currentBucket: number | null = null
    let latest = 0
    let firstDate: Date | null = null
    let lastDate: Date | null = null
    chronological.forEach((session) => {
      const value = pick(session.sets)
      if (!(value > 0)) return
      latest = value
      firstDate = firstDate ?? session.date
      lastDate = session.date
      const bucket =
        !grouped || bucketDays === 0
          ? points.length
          : Math.floor(
              (session.date.getTime() - firstTime) / (bucketDays * DAY_MS),
            )
      const last = points[points.length - 1]
      if (last && bucket === currentBucket) {
        const sum = sums[sums.length - 1]
        sum.total += value
        sum.count += 1
        last.value = sum.total / sum.count
        last.date = session.date
      } else {
        points.push({ date: session.date, value })
        sums.push({ total: value, count: 1 })
        currentBucket = bucket
      }
    })
    return { points, latest, firstDate, lastDate }
  }

  const best1RM = collect(
    (sets) =>
      Math.max(
        0,
        ...sets.map((set) =>
          estimateOneRepMaxKg(set.weight ?? 0, set.reps ?? 0),
        ),
      ),
    false,
  )
  const heaviest = collect(
    (sets) => Math.max(0, ...sets.map((set) => set.weight ?? 0)),
    false,
  )
  const volume = collect(
    (sets) =>
      sets.reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0),
    true,
  )
  const bestReps = collect(
    (sets) => Math.max(0, ...sets.map((set) => set.reps ?? 0)),
    false,
  )
  const totalReps = collect(
    (sets) => sets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
    true,
  )

  if (isRepBased) {
    return [
      { key: 'best-reps', title: 'Best Set', kind: 'line', unit: 'reps', ...bestReps },
      { key: 'total-reps', title: 'Total Reps', kind: 'bar', unit: 'reps', ...totalReps },
    ]
  }

  return [
    { key: 'e1rm', title: 'Estimated 1RM', kind: 'line', unit: 'weight', ...best1RM },
    { key: 'heaviest', title: 'Heaviest Weight', kind: 'line', unit: 'weight', ...heaviest },
    { key: 'volume', title: 'Volume', kind: 'bar', unit: 'weight', ...volume },
    { key: 'reps', title: 'Total Reps', kind: 'bar', unit: 'reps', ...totalReps },
  ]
}

export function ExerciseProgressTab({
  sessions,
  isRepBased,
  range,
}: ExerciseProgressTabProps) {
  const metrics = useMemo(
    () => buildMetrics(sessions, isRepBased, range),
    [sessions, isRepBased, range],
  )
  const hasAnySessions = sessions.length > 0

  return (
    <View style={{ gap: 16 }}>
      {metrics.map((metric) => (
        <ProgressChartCard
          key={metric.key}
          metric={metric}
          emptyText={
            hasAnySessions && range !== 'ALL'
              ? `No workouts in the ${PROGRESS_RANGE_LABELS[range].toLowerCase()}`
              : 'No workouts logged yet'
          }
        />
      ))}
    </View>
  )
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ProgressChartCard({
  metric,
  emptyText,
}: {
  metric: MetricConfig
  emptyText: string
}) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { weightUnit, convertToPreferred } = useWeightUnits()
  const styles = createStyles(colors)
  const [width, setWidth] = useState(0)

  const toDisplay = (value: number) =>
    metric.unit === 'weight' ? convertToPreferred(value) ?? 0 : value
  const unitLabel = metric.unit === 'weight' ? weightUnit : 'reps'
  const formatNumber = (value: number) =>
    Math.round(value).toLocaleString(undefined)

  const hasData = metric.points.length > 0
  const values = hasData
    ? metric.points.map((point) => toDisplay(point.value))
    : PLACEHOLDER_VALUES
  const latest = hasData ? toDisplay(metric.latest) : 0
  const change = hasData ? values[values.length - 1] - values[0] : 0

  let subtitle = emptyText
  if (hasData && metric.points.length === 1) {
    subtitle = formatShortDate(metric.firstDate ?? metric.points[0].date)
  } else if (hasData) {
    const sinceDate = formatShortDate(metric.firstDate ?? metric.points[0].date)
    if (Math.round(change) === 0) {
      subtitle = `No change since ${sinceDate}`
    } else {
      const sign = change > 0 ? '+' : '−'
      subtitle = `${sign}${formatNumber(Math.abs(change))} ${unitLabel} since ${sinceDate}`
    }
  }
  const subtitleColor =
    hasData && metric.points.length > 1 && Math.round(change) > 0
      ? colors.statusSuccessText
      : colors.textSecondary

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width)

  const accent = hasData ? colors.brandPrimary : colors.textTertiary

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{metric.title}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, !hasData && styles.valueEmpty]}>
          {formatNumber(latest)}
        </Text>
        <Text style={[styles.unit, !hasData && styles.valueEmpty]}>
          {unitLabel}
        </Text>
      </View>
      <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>

      <View style={styles.chart} onLayout={onLayout}>
        {width > 0 ? (
          <ChartSvg
            width={width}
            values={values}
            kind={metric.kind}
            accent={accent}
            gridColor={colors.border}
            surfaceColor={colors.surfaceCard}
            isDark={isDark}
            dimmed={!hasData}
          />
        ) : null}
      </View>

      {hasData && metric.points.length > 1 ? (
        <View style={styles.axis}>
          <Text style={styles.axisText}>
            {formatShortDate(metric.firstDate ?? metric.points[0].date)}
          </Text>
          <Text style={styles.axisText}>
            {formatShortDate(metric.lastDate ?? metric.points[metric.points.length - 1].date)}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function ChartSvg({
  width,
  values,
  kind,
  accent,
  gridColor,
  surfaceColor,
  dimmed,
  isDark,
}: {
  width: number
  values: number[]
  kind: ChartKind
  accent: string
  gridColor: string
  surfaceColor: string
  isDark: boolean
  dimmed: boolean
}) {
  const height = CHART_HEIGHT
  const padTop = 8
  const padBottom = 6
  const plotHeight = height - padTop - padBottom

  const max = Math.max(...values)
  const min = kind === 'bar' ? 0 : Math.min(...values)
  // Give line charts headroom so a flat line sits in the middle.
  const span = max - min || Math.max(1, max * 0.2)
  const lower = kind === 'bar' ? 0 : min - span * 0.15
  const upper = max + span * 0.15
  const yFor = (value: number) =>
    padTop + plotHeight - ((value - lower) / (upper - lower)) * plotHeight

  const grid = Array.from({ length: GRID_LINES }, (_, index) =>
    padTop + (plotHeight / (GRID_LINES - 1)) * index,
  )
  const gridLines = grid.map((y) => (
    <SvgLine
      key={y}
      x1={0}
      x2={width}
      y1={y}
      y2={y}
      stroke={gridColor}
      strokeWidth={StyleSheet.hairlineWidth}
    />
  ))

  if (kind === 'bar') {
    const slot = width / values.length
    const barWidth = Math.min(28, slot * 0.62)
    const bottom = padTop + plotHeight
    return (
      <Svg width={width} height={height}>
        {gridLines}
        {values.map((value, index) => {
          const y = yFor(value)
          const isLast = index === values.length - 1
          return (
            <Rect
              key={index}
              x={slot * index + (slot - barWidth) / 2}
              y={y}
              width={barWidth}
              height={Math.max(2, bottom - y)}
              rx={Math.min(6, barWidth / 3)}
              fill={accent}
              opacity={dimmed ? 0.35 : isLast ? 1 : isDark ? 0.6 : 0.45}
            />
          )
        })}
      </Svg>
    )
  }

  const inset = 7
  const step = values.length > 1 ? (width - inset * 2) / (values.length - 1) : 0
  const points = values.map((value, index) => ({
    x: values.length > 1 ? inset + step * index : width / 2,
    y: yFor(value),
  }))
  const line = buildSmoothPath(points)
  const bottom = padTop + plotHeight
  const area =
    points.length > 1
      ? `${line} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`
      : ''
  const last = points[points.length - 1]

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="progressArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity={dimmed ? 0.08 : isDark ? 0.26 : 0.18} />
          <Stop offset="1" stopColor={accent} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {gridLines}
      {area ? <Path d={area} fill="url(#progressArea)" /> : null}
      {points.length > 1 ? (
        <Path
          d={line}
          stroke={accent}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          opacity={dimmed ? 0.5 : 1}
        />
      ) : null}
      {!dimmed && points.length <= MAX_DOTTED_POINTS
        ? points.slice(0, -1).map((point, index) => (
            <Circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={3.5}
              fill={accent}
            />
          ))
        : null}
      {!dimmed ? (
        <Circle
          cx={last.x}
          cy={last.y}
          r={5}
          fill={surfaceColor}
          stroke={accent}
          strokeWidth={2.5}
        />
      ) : null}
    </Svg>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 16,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
      marginTop: 6,
    },
    value: {
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -0.8,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    unit: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    valueEmpty: {
      color: colors.textTertiary,
    },
    subtitle: {
      fontSize: 13,
      fontWeight: '500',
      marginTop: 2,
    },
    chart: {
      marginTop: 18,
      height: CHART_HEIGHT,
    },
    axis: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    axisText: {
      fontSize: 12,
      color: colors.textTertiary,
    },
  })

const RANGE_BUTTON_TEXT: Record<Exclude<ProgressRange, 'ALL'>, string> = {
  '3M': '3M',
  '6M': '6M',
  '1Y': '1Y',
}

/** Header button that cycles the Progress tab's time range on each tap. */
export function ProgressRangeButton({
  range,
  onChange,
}: {
  range: ProgressRange
  onChange: (range: ProgressRange) => void
}) {
  const colors = useThemedColors()
  const next =
    PROGRESS_RANGES[(PROGRESS_RANGES.indexOf(range) + 1) % PROGRESS_RANGES.length]

  return (
    <LiquidGlassSurface style={rangeButtonStyles.container}>
      <TouchableOpacity
        style={rangeButtonStyles.touchable}
        onPress={() => {
          haptic('light')
          onChange(next)
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Time range: ${PROGRESS_RANGE_LABELS[range]}. Tap for ${PROGRESS_RANGE_LABELS[next]}`}
      >
        {range === 'ALL' ? (
          <Ionicons name="infinite" size={24} color={colors.textPrimary} />
        ) : (
          <Text style={[rangeButtonStyles.label, { color: colors.textPrimary }]}>
            {RANGE_BUTTON_TEXT[range]}
          </Text>
        )}
      </TouchableOpacity>
    </LiquidGlassSurface>
  )
}

const rangeButtonStyles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchable: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
})
