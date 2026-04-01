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
  const valueRef = useRef(value)
  const lastEmittedValueRef = useRef(value)
  const isDraggingRef = useRef(false)
  const hasMomentumRef = useRef(false)
  const queuedExternalValueRef = useRef<number | null>(null)
  const endDragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  valueRef.current = value

  const clearEndDragTimeout = useCallback(() => {
    if (endDragTimeoutRef.current === null) return
    clearTimeout(endDragTimeoutRef.current)
    endDragTimeoutRef.current = null
  }, [])

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

  useLayoutEffect(() => {
    syncScrollToValue(valueRef.current)
    lastEmittedValueRef.current = valueRef.current
  }, [min, max, step, syncScrollToValue])

  useEffect(() => {
    if (value === lastEmittedValueRef.current) return
    if (isDraggingRef.current || hasMomentumRef.current) {
      queuedExternalValueRef.current = value
      return
    }
    syncScrollToValue(value)
    lastEmittedValueRef.current = value
  }, [value, syncScrollToValue])

  useEffect(() => clearEndDragTimeout, [clearEndDragTimeout])

  const emitValue = useCallback(
    (next: number) => {
      if (next === lastEmittedValueRef.current) return
      lastEmittedValueRef.current = next
      onValueChange(next)
    },
    [onValueChange],
  )

  const finalizeOffset = useCallback(
    (offsetX: number) => {
      const next = valueFromOffset(offsetX)
      emitValue(next)
      syncScrollToValue(next)
      isDraggingRef.current = false
      hasMomentumRef.current = false

      const queuedValue = queuedExternalValueRef.current
      queuedExternalValueRef.current = null

      if (queuedValue !== null && queuedValue !== next) {
        lastEmittedValueRef.current = queuedValue
        syncScrollToValue(queuedValue)
      } else {
        lastEmittedValueRef.current = next
      }
    },
    [emitValue, syncScrollToValue, valueFromOffset],
  )

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x
      emitValue(valueFromOffset(offsetX))
    },
    [emitValue, valueFromOffset],
  )

  const handleScrollBeginDrag = useCallback(() => {
    clearEndDragTimeout()
    queuedExternalValueRef.current = null
    hasMomentumRef.current = false
    isDraggingRef.current = true
  }, [clearEndDragTimeout])

  const handleMomentumScrollBegin = useCallback(() => {
    clearEndDragTimeout()
    hasMomentumRef.current = true
  }, [clearEndDragTimeout])

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x
      clearEndDragTimeout()
      endDragTimeoutRef.current = setTimeout(() => {
        if (!hasMomentumRef.current) {
          finalizeOffset(offsetX)
        }
      }, 0)
    },
    [clearEndDragTimeout, finalizeOffset],
  )

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      clearEndDragTimeout()
      finalizeOffset(event.nativeEvent.contentOffset.x)
    },
    [clearEndDragTimeout, finalizeOffset],
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
          onScrollBeginDrag={handleScrollBeginDrag}
          onScroll={handleScroll}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollBegin={handleMomentumScrollBegin}
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
