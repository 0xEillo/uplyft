import { useUnit } from '@/contexts/unit-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  PanResponder,
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
  Stop,
  Line as SvgLine,
  Text as SvgText,
} from 'react-native-svg'

// ── Types ─────────────────────────────────────────────────────────────────────

type TimeRange = '1M' | '3M' | '6M' | 'ALL'

interface WeightDataPoint {
  date: Date
  weightKg: number
}

interface BodyWeightChartProps {
  userId: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_H = 180
const CHART_PADDING_TOP = 24
const CHART_PADDING_BOTTOM = 28
const CHART_PADDING_LEFT = 44
const CHART_PADDING_RIGHT = 16
const { width: SCREEN_W } = Dimensions.get('window')
const CHART_W = SCREEN_W - 40 // 20px outer padding each side

const TIME_RANGES: { key: TimeRange; label: string; days: number | null }[] = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: 'ALL', label: 'All', days: null },
]

const GRID_LINE_COUNT = 4

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatAxisDate(date: Date, range: TimeRange): string {
  if (range === '1M') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  // 3M, 6M, ALL: use month + year
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

/**
 * Monotone cubic Hermite interpolation (Fritsch–Carlson method).
 * Guarantees no overshooting between data points — produces clean,
 * professional curves even with sparse or volatile data.
 */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M ${points[0].x} ${points[0].y}`
  if (n === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

  // 1. Compute slopes of secant lines between successive points
  const dx: number[] = []
  const dy: number[] = []
  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x)
    dy.push(points[i + 1].y - points[i].y)
    slopes.push(dx[i] === 0 ? 0 : dy[i] / dx[i])
  }

  // 2. Compute initial tangents using average of adjacent slopes
  const tangents: number[] = [slopes[0]]
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      // Sign change or zero — flat tangent to prevent overshoot
      tangents.push(0)
    } else {
      // Harmonic mean of adjacent slopes (better monotonicity)
      tangents.push(
        2 / (1 / slopes[i - 1] + 1 / slopes[i])
      )
    }
  }
  tangents.push(slopes[n - 2])

  // 3. Fritsch–Carlson correction to ensure monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slopes[i]) < 1e-10) {
      tangents[i] = 0
      tangents[i + 1] = 0
    } else {
      const alpha = tangents[i] / slopes[i]
      const beta = tangents[i + 1] / slopes[i]
      // Restrict to a circle of radius 3 to ensure monotonicity
      const mag = Math.sqrt(alpha * alpha + beta * beta)
      if (mag > 3) {
        const tau = 3 / mag
        tangents[i] = tau * alpha * slopes[i]
        tangents[i + 1] = tau * beta * slopes[i]
      }
    }
  }

  // 4. Build cubic Bézier path from Hermite tangents
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const segLen = dx[i] / 3
    const cp1x = points[i].x + segLen
    const cp1y = points[i].y + tangents[i] * segLen
    const cp2x = points[i + 1].x - segLen
    const cp2y = points[i + 1].y - tangents[i + 1] * segLen
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i + 1].x} ${points[i + 1].y}`
  }

  return d
}

function buildAreaPath(
  points: { x: number; y: number }[],
  bottomY: number,
): string {
  if (points.length === 0) return ''
  const linePath = buildSmoothPath(points)
  const lastPoint = points[points.length - 1]
  const firstPoint = points[0]
  return `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`
}

// ── Component ─────────────────────────────────────────────────────────────────

export const BodyWeightChart = memo(({ userId }: BodyWeightChartProps) => {
  const colors = useThemedColors()
  const { convertToPreferred, weightUnit } = useUnit()

  const [rawData, setRawData] = useState<WeightDataPoint[]>([])
  const [selectedRange, setSelectedRange] = useState<TimeRange>('6M')
  const [isLoading, setIsLoading] = useState(true)
  const fadeAnim = useRef(new Animated.Value(0)).current

  // ── Interaction state ────────────────────────────────────────────────────

  type ActivePoint = { x: number; y: number; weight: number; date: Date } | null
  const [activePoint, setActivePoint] = useState<ActivePoint>(null)
  const tooltipAnim = useRef(new Animated.Value(0)).current
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const history = await database.dailyLog.getWeightHistory(userId)
      const points: WeightDataPoint[] = (history ?? []).map((entry) => ({
        date: new Date(`${entry.log_date}T12:00:00`),
        weightKg: entry.weight_kg,
      }))
      setRawData(points)
    } catch (err) {
      console.error('[BodyWeightChart] fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!isLoading && rawData.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start()
    }
  }, [isLoading, rawData.length, fadeAnim])

  // ── Filtered data ────────────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    const rangeConfig = TIME_RANGES.find((r) => r.key === selectedRange)
    if (!rangeConfig || !rangeConfig.days) return rawData
    const cutoff = daysAgo(rangeConfig.days)
    return rawData.filter((d) => d.date >= cutoff)
  }, [rawData, selectedRange])

  // ── Chart geometry ───────────────────────────────────────────────────────

  const chartGeometry = useMemo(() => {
    if (filteredData.length === 0) return null

    const convertedWeights = filteredData.map(
      (d) => convertToPreferred(d.weightKg) ?? d.weightKg,
    )

    const minW = Math.min(...convertedWeights)
    const maxW = Math.max(...convertedWeights)

    // Compute "nice" tick step for human-friendly axis labels
    const rawRange = maxW - minW || 1
    const roughStep = rawRange / (GRID_LINE_COUNT - 1)
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
    const residual = roughStep / magnitude
    const niceStep =
      residual <= 1.5 ? 1 * magnitude
      : residual <= 3 ? 2 * magnitude
      : residual <= 7 ? 5 * magnitude
      : 10 * magnitude

    // Snap domain to nice round boundaries
    const domainMin = Math.floor(minW / niceStep) * niceStep
    const domainMax = Math.ceil(maxW / niceStep) * niceStep

    const drawableW = CHART_W - CHART_PADDING_LEFT - CHART_PADDING_RIGHT
    const drawableH = CHART_H - CHART_PADDING_TOP - CHART_PADDING_BOTTOM

    const minTime = filteredData[0].date.getTime()
    const maxTime = filteredData[filteredData.length - 1].date.getTime()
    const timeRange = maxTime - minTime || 1
    const domainRange = domainMax - domainMin || 1

    const points = filteredData.map((d, i) => {
      const w = convertedWeights[i]
      const x =
        CHART_PADDING_LEFT +
        ((d.date.getTime() - minTime) / timeRange) * drawableW
      const y =
        CHART_PADDING_TOP +
        (1 - (w - domainMin) / domainRange) * drawableH
      return { x, y, weight: w, date: d.date }
    })

    // Grid lines at nice round values
    const gridLines: { y: number; label: string }[] = []
    for (let val = domainMax; val >= domainMin - niceStep * 0.01; val -= niceStep) {
      const y =
        CHART_PADDING_TOP +
        (1 - (val - domainMin) / domainRange) * drawableH
      gridLines.push({
        y,
        label: `${Math.round(val)}`,
      })
    }

    // X-axis labels — collision-safe placement
    // Target up to 5 labels spread evenly across the time axis,
    // but suppress any candidate that's too close in pixel space to a neighbour.
    const MIN_LABEL_SPACING = 48 // minimum px between label centres
    const TARGET_LABEL_COUNT = 5
    const xLabels: { x: number; label: string }[] = []

    if (filteredData.length === 1) {
      // Only one point — just show it
      xLabels.push({
        x: CHART_PADDING_LEFT,
        label: formatAxisDate(filteredData[0].date, selectedRange),
      })
    } else {
      // Build a candidate list by picking the data point closest to each
      // evenly-spaced target position along the pixel x-axis
      const candidates: { x: number; label: string }[] = []
      for (let i = 0; i < TARGET_LABEL_COUNT; i++) {
        const targetFrac = i / (TARGET_LABEL_COUNT - 1)
        const targetTime = minTime + targetFrac * timeRange
        // Find the data point whose time is closest to targetTime
        let bestIdx = 0
        let bestDist = Infinity
        filteredData.forEach((d, idx) => {
          const dist = Math.abs(d.date.getTime() - targetTime)
          if (dist < bestDist) { bestDist = dist; bestIdx = idx }
        })
        const d = filteredData[bestIdx]
        const x =
          CHART_PADDING_LEFT +
          ((d.date.getTime() - minTime) / timeRange) * drawableW
        candidates.push({ x, label: formatAxisDate(d.date, selectedRange) })
      }

      // De-duplicate candidates that mapped to the same data point
      const deduped = candidates.filter(
        (c, i) => i === 0 || c.label !== candidates[i - 1].label || Math.abs(c.x - candidates[i - 1].x) > 1,
      )

      // Greedily accept labels left-to-right, suppressing any that are
      // within MIN_LABEL_SPACING px of an already-accepted label
      for (const candidate of deduped) {
        const tooClose = xLabels.some(
          (accepted) => Math.abs(candidate.x - accepted.x) < MIN_LABEL_SPACING,
        )
        if (!tooClose) {
          xLabels.push(candidate)
        }
      }
    }

    const linePath = buildSmoothPath(points)
    const areaPath = buildAreaPath(
      points,
      CHART_PADDING_TOP + drawableH,
    )

    const lastPoint = points[points.length - 1]
    const firstPoint = points[0]

    return {
      points,
      linePath,
      areaPath,
      gridLines,
      xLabels,
      lastPoint,
      firstPoint,
      bottomY: CHART_PADDING_TOP + drawableH,
    }
  }, [filteredData, convertToPreferred, selectedRange])

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null

    const latest = filteredData[filteredData.length - 1]
    const first = filteredData[0]
    const currentW = convertToPreferred(latest.weightKg) ?? latest.weightKg
    const startW = convertToPreferred(first.weightKg) ?? first.weightKg
    const delta = currentW - startW

    return {
      current: currentW,
      delta,
      isGain: delta > 0,
      isLoss: delta < 0,
    }
  }, [filteredData, convertToPreferred])

  // ── PanResponder (must be top-level, no conditionals) ─────────────────

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      const touchX = evt.nativeEvent.locationX
      const pts = chartGeometry?.points
      if (!pts || pts.length === 0) return
      const nearest = pts.reduce((best, p) =>
        Math.abs(p.x - touchX) < Math.abs(best.x - touchX) ? p : best
      )
      setActivePoint(nearest)
      Animated.spring(tooltipAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 180,
        friction: 14,
      }).start()
    },
    onPanResponderMove: (evt) => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      const touchX = evt.nativeEvent.locationX
      const pts = chartGeometry?.points
      if (!pts || pts.length === 0) return
      const nearest = pts.reduce((best, p) =>
        Math.abs(p.x - touchX) < Math.abs(best.x - touchX) ? p : best
      )
      setActivePoint(nearest)
    },
    onPanResponderRelease: () => {
      dismissTimer.current = setTimeout(() => {
        Animated.timing(tooltipAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setActivePoint(null))
      }, 1200)
    },
  }), [chartGeometry, tooltipAnim])

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={styles.loadingPulse} />
      </View>
    )
  }

  if (rawData.length < 2) {
    return null // Need at least 2 data points
  }

  const accentColor = colors.brandPrimary
  const gridColor = colors.border
  const labelColor = colors.textTertiary

  return (
    <View style={styles.outerWrap}>
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: colors.surfaceCard,
            borderColor: colors.border,
            opacity: fadeAnim,
          },
        ]}
      >
        {/* ── Time range pills + delta badge ── */}
        <View style={styles.pillRow}>
          <View style={styles.pillGroup}>
            {TIME_RANGES.map((range) => {
              const isActive = selectedRange === range.key
              return (
                <TouchableOpacity
                  key={range.key}
                  style={[
                    styles.pill,
                    isActive
                      ? { backgroundColor: accentColor }
                      : { backgroundColor: colors.surfaceSubtle },
                  ]}
                  onPress={() => setSelectedRange(range.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.pillLabel,
                      isActive
                        ? { color: '#fff', fontWeight: '700' }
                        : { color: colors.textSecondary, fontWeight: '600' },
                    ]}
                  >
                    {range.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {stats && stats.delta !== 0 && (
            <View
              style={[
                styles.deltaBadge,
                {
                  backgroundColor: stats.isLoss
                    ? `${colors.statusSuccess}16`
                    : `${colors.statusError}16`,
                },
              ]}
            >
              <Text
                style={[
                  styles.deltaText,
                  {
                    color: stats.isLoss
                      ? colors.statusSuccess
                      : colors.statusError,
                  },
                ]}
              >
                {stats.isGain ? '+' : ''}
                {stats.delta.toFixed(weightUnit === 'kg' ? 1 : 0)} {weightUnit}
              </Text>
            </View>
          )}
        </View>

        {/* ── Chart ── */}
        {chartGeometry && filteredData.length >= 2 ? (
          <View style={styles.chartWrap} {...panResponder.panHandlers}>
            <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
              <Defs>
                <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={accentColor} stopOpacity={0.22} />
                  <Stop offset="100%" stopColor={accentColor} stopOpacity={0.0} />
                </LinearGradient>
                <LinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor={accentColor} stopOpacity={0.5} />
                  <Stop offset="100%" stopColor={accentColor} stopOpacity={1} />
                </LinearGradient>
              </Defs>

              {/* Grid lines */}
              {chartGeometry.gridLines.map((gl, i) => (
                <SvgLine
                  key={`grid-${i}`}
                  x1={CHART_PADDING_LEFT}
                  y1={gl.y}
                  x2={CHART_W - CHART_PADDING_RIGHT}
                  y2={gl.y}
                  stroke={gridColor}
                  strokeWidth={StyleSheet.hairlineWidth}
                  strokeDasharray="4 4"
                  opacity={0.5}
                />
              ))}

              {/* Y-axis labels */}
              {chartGeometry.gridLines.map((gl, i) => (
                <SvgText
                  key={`ylabel-${i}`}
                  x={CHART_PADDING_LEFT - 8}
                  y={gl.y + 4}
                  textAnchor="end"
                  fontSize={10}
                  fontWeight="500"
                  fill={labelColor}
                  opacity={0.7}
                >
                  {gl.label}
                </SvgText>
              ))}

              {/* Area fill */}
              <Path d={chartGeometry.areaPath} fill="url(#areaGrad)" />

              {/* Line */}
              <Path
                d={chartGeometry.linePath}
                stroke="url(#lineGrad)"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Resting end dot — hidden when scrubbing */}
              {!activePoint && (
                <>
                  <Circle
                    cx={chartGeometry.lastPoint.x}
                    cy={chartGeometry.lastPoint.y}
                    r={7}
                    fill={accentColor}
                    opacity={0.18}
                  />
                  <Circle
                    cx={chartGeometry.lastPoint.x}
                    cy={chartGeometry.lastPoint.y}
                    r={4}
                    fill={accentColor}
                  />
                  <Circle
                    cx={chartGeometry.lastPoint.x}
                    cy={chartGeometry.lastPoint.y}
                    r={1.8}
                    fill={colors.surfaceCard}
                  />
                </>
              )}

              {/* Scrubber: vertical line + active dot */}
              {activePoint && (
                <>
                  <SvgLine
                    x1={activePoint.x}
                    y1={CHART_PADDING_TOP}
                    x2={activePoint.x}
                    y2={chartGeometry.bottomY}
                    stroke={accentColor}
                    strokeWidth={1.5}
                    opacity={0.5}
                    strokeDasharray="3 3"
                  />
                  <Circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r={9}
                    fill={accentColor}
                    opacity={0.15}
                  />
                  <Circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r={5}
                    fill={accentColor}
                  />
                  <Circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r={2.2}
                    fill={colors.surfaceCard}
                  />
                </>
              )}

              {/* X-axis labels */}
              {chartGeometry.xLabels.map((xl, i) => (
                <SvgText
                  key={`xlabel-${i}`}
                  x={xl.x}
                  y={CHART_H - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="500"
                  fill={labelColor}
                  opacity={0.7}
                >
                  {xl.label}
                </SvgText>
              ))}
            </Svg>

            {/* Tooltip bubble — rendered in RN so it can be animated */}
            {activePoint && (() => {
              const TOOLTIP_W = 110
              const TOOLTIP_H = 46
              // Clamp so it stays inside the chart
              const rawLeft = activePoint.x - TOOLTIP_W / 2
              const clampedLeft = Math.max(
                CHART_PADDING_LEFT,
                Math.min(rawLeft, CHART_W - CHART_PADDING_RIGHT - TOOLTIP_W),
              )
              const aboveY = activePoint.y - TOOLTIP_H - 12
              const tooltipTop = aboveY < CHART_PADDING_TOP
                ? activePoint.y + 16
                : aboveY
              return (
                <Animated.View
                  style={[
                    styles.tooltip,
                    {
                      left: clampedLeft,
                      top: tooltipTop,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: tooltipAnim,
                      transform: [{ scale: tooltipAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.88, 1],
                      }) }],
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Text style={[styles.tooltipWeight, { color: colors.textPrimary }]}>
                    {activePoint.weight.toFixed(weightUnit === 'kg' ? 1 : 0)} {weightUnit}
                  </Text>
                  <Text style={[styles.tooltipDate, { color: colors.textTertiary }]}>
                    {activePoint.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </Text>
                </Animated.View>
              )
            })()}
          </View>
        ) : (
          <View style={[styles.chartWrap, styles.emptyChart]}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Not enough data for this range
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  )
})

BodyWeightChart.displayName = 'BodyWeightChart'

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  container: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 8,
  },
  loadingPulse: {
    height: CHART_H + 100,
    borderRadius: 18,
    opacity: 0.06,
  },

  deltaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  deltaText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pillLabel: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  chartWrap: {
    alignItems: 'center',
    position: 'relative',
  },
  emptyChart: {
    height: CHART_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tooltip: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  tooltipWeight: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  tooltipDate: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
})
