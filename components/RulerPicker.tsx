import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useThemedColors } from '@/hooks/useThemedColors'

interface RulerPickerProps {
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step: number
  label: string
  unit: string
}

const TICK_WIDTH = 10

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

export function RulerPicker({
  value,
  onValueChange,
  min,
  max,
  step,
  label,
  unit,
}: RulerPickerProps) {
  const colors = useThemedColors()
  const { width } = useWindowDimensions()
  const scrollViewRef = useRef<ScrollView>(null)
  /** Latest value so scale/layout updates can re-center without fighting active drags. */
  const valueRef = useRef(value)
  const lastReportedValueRef = useRef(value)
  valueRef.current = value

  const totalTicks = Math.floor((max - min) / step) + 1
  const tickIndices = useMemo(
    () => Array.from({ length: totalTicks }, (_, index) => index),
    [totalTicks],
  )

  const offsetForValue = useCallback(
    (v: number) => {
      const tickIndex = Math.round((v - min) / step)
      return tickIndex * TICK_WIDTH
    },
    [min, step],
  )

  const valueFromOffset = useCallback(
    (offsetX: number) => {
      const tickIndex = Math.round(offsetX / TICK_WIDTH)
      return clamp(min + tickIndex * step, min, max)
    },
    [min, max, step],
  )

  const syncScrollToValue = useCallback(
    (v: number) => {
      scrollViewRef.current?.scrollTo({
        x: offsetForValue(v),
        animated: false,
      })
    },
    [offsetForValue],
  )

  // Align ruler when the scale changes — never on every `value` tick (that caused scrollTo vs finger fights).
  useLayoutEffect(() => {
    syncScrollToValue(valueRef.current)
    lastReportedValueRef.current = valueRef.current
  }, [min, max, step, syncScrollToValue])

  useEffect(() => {
    if (value === lastReportedValueRef.current) return
    syncScrollToValue(value)
    lastReportedValueRef.current = value
  }, [value, syncScrollToValue])

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x
      const next = valueFromOffset(offsetX)
      lastReportedValueRef.current = next
      if (next !== value) {
        onValueChange(next)
      }
    },
    [value, valueFromOffset, onValueChange],
  )

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x
      const next = valueFromOffset(offsetX)
      lastReportedValueRef.current = next
      syncScrollToValue(next)
      if (next !== value) {
        onValueChange(next)
      }
    },
    [value, valueFromOffset, onValueChange, syncScrollToValue],
  )

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginBottom: 24,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          paddingHorizontal: 16,
          marginBottom: 8,
        },
        label: {
          fontSize: 16,
          fontWeight: '800',
          color: colors.textSecondary,
          letterSpacing: 1,
        },
        valueContainer: {
          flexDirection: 'row',
          alignItems: 'baseline',
        },
        value: {
          fontSize: 48,
          fontWeight: '800',
          color: colors.textPrimary,
        },
        unit: {
          fontSize: 18,
          fontWeight: '600',
          color: colors.textPrimary,
          marginLeft: 4,
        },
        rulerContainer: {
          height: 60,
          justifyContent: 'flex-end',
        },
        rulerContent: {
          paddingHorizontal: (width - TICK_WIDTH) / 2,
        },
        tick: {
          width: TICK_WIDTH,
          justifyContent: 'flex-end',
          alignItems: 'center',
        },
        tickLine: {
          width: 2,
          backgroundColor: colors.border,
          borderRadius: 1,
        },
        tickMajor: {
          height: 30,
          backgroundColor: colors.textSecondary,
        },
        tickMinor: {
          height: 15,
        },
        indicator: {
          position: 'absolute',
          left: width / 2 - 1,
          bottom: 0,
          width: 2,
          height: 40,
          backgroundColor: colors.brandPrimary,
          borderRadius: 1,
        },
      }),
    [colors, width],
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>
      </View>

      <View style={styles.rulerContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          snapToInterval={TICK_WIDTH}
          decelerationRate="fast"
          contentContainerStyle={styles.rulerContent}
        >
          {tickIndices.map((i) => (
            <View key={i} style={styles.tick}>
              <View
                style={[
                  styles.tickLine,
                  i % 10 === 0 ? styles.tickMajor : styles.tickMinor,
                ]}
              />
            </View>
          ))}
        </ScrollView>
        <View style={styles.indicator} pointerEvents="none" />
      </View>
    </View>
  )
}
