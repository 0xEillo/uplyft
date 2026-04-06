import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, StyleSheet, Text, useWindowDimensions, View } from 'react-native'

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
const TAP_SLOP = 5

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
  const rulerWidth = Math.max(0, width - 16)
  const sidePadding = Math.max(0, (rulerWidth - TICK_WIDTH) / 2)

  const clampValue = useCallback(
    (next: number) => clamp(next, min, max),
    [max, min],
  )

  const [draftValue, setDraftValue] = useState(() => clampValue(value))
  const draftValueRef = useRef(draftValue)
  const gestureStartValueRef = useRef(draftValue)
  const isPanningRef = useRef(false)
  const ignorePropsUntilRef = useRef(0)
  const pendingValueRef = useRef<number | null>(null)
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const totalTicks = Math.floor((max - min) / step) + 1
  const tickIndices = useMemo(
    () => Array.from({ length: totalTicks }, (_, index) => index),
    [totalTicks],
  )

  useEffect(() => {
    if (isPanningRef.current || Date.now() < ignorePropsUntilRef.current) return
    const next = clampValue(value)
    if (next !== draftValueRef.current) {
      draftValueRef.current = next
      setDraftValue(next)
    }
  }, [clampValue, value])

  const onValueChangeRef = useRef(onValueChange)
  useEffect(() => {
    onValueChangeRef.current = onValueChange
  }, [onValueChange])

  const flushValueChange = useCallback(() => {
    if (pendingValueRef.current !== null) {
      onValueChangeRef.current(pendingValueRef.current)
      pendingValueRef.current = null
    }
    throttleTimeoutRef.current = null
  }, [])

  const setNextValue = useCallback(
    (next: number) => {
      const clamped = clampValue(next)
      if (clamped === draftValueRef.current) return

      draftValueRef.current = clamped
      setDraftValue(clamped)

      pendingValueRef.current = clamped
      if (!throttleTimeoutRef.current) {
        throttleTimeoutRef.current = setTimeout(flushValueChange, 32)
      }
    },
    [clampValue, flushValueChange],
  )

  const offsetForValue = useCallback(
    (next: number) => Math.round((clampValue(next) - min) / step) * TICK_WIDTH,
    [clampValue, min, step],
  )

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          isPanningRef.current = true
          gestureStartValueRef.current = draftValueRef.current
        },
        onPanResponderMove: (_event, gestureState) => {
          const tickDelta = Math.round(-gestureState.dx / TICK_WIDTH)
          const target = gestureStartValueRef.current + tickDelta * step
          setNextValue(target)
        },
        onPanResponderRelease: (event, gestureState) => {
          isPanningRef.current = false
          ignorePropsUntilRef.current = Date.now() + 250

          const wasTap =
            Math.abs(gestureState.dx) < TAP_SLOP &&
            Math.abs(gestureState.dy) < TAP_SLOP

          if (wasTap) {
            const loc = event.nativeEvent as {
              locationX?: number
            }
            const distanceFromCenter = (loc.locationX ?? 0) - rulerWidth / 2
            const tickDelta = Math.round(distanceFromCenter / TICK_WIDTH)
            setNextValue(draftValueRef.current + tickDelta * step)
          }

          if (throttleTimeoutRef.current) {
            clearTimeout(throttleTimeoutRef.current)
          }
          flushValueChange()
        },
        onPanResponderTerminate: () => {
          isPanningRef.current = false
          ignorePropsUntilRef.current = Date.now() + 250
          gestureStartValueRef.current = draftValueRef.current

          if (throttleTimeoutRef.current) {
            clearTimeout(throttleTimeoutRef.current)
          }
          flushValueChange()
        },
      }),
    [rulerWidth, setNextValue, step, flushValueChange],
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
          width: rulerWidth,
          alignSelf: 'center',
          overflow: 'hidden',
        },
        rulerContent: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          height: '100%',
          paddingHorizontal: sidePadding,
          transform: [{ translateX: -offsetForValue(draftValue) }],
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
          left: rulerWidth / 2 - 1,
          bottom: 0,
          width: 2,
          height: 40,
          backgroundColor: colors.brandPrimary,
          borderRadius: 1,
        },
      }),
    [colors, draftValue, offsetForValue, rulerWidth, sidePadding],
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{draftValue}</Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>
      </View>

      <View style={styles.rulerContainer}>
        <View style={styles.rulerContent}>
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
        </View>
        <View style={styles.indicator} pointerEvents="none" />
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
      </View>
    </View>
  )
}
