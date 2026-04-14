import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native'

import { useThemedColors } from '@/hooks/useThemedColors'

interface RulerPickerProps {
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step: number
  dragMultiplier?: number
  label: string
  unit: string
}

const TICK_WIDTH = 10
const TAP_SLOP = 5
const DIRECTION_LOCK_THRESHOLD = 8
const MOMENTUM_DECAY_PER_FRAME = 0.92
const MOMENTUM_STOP_SPEED = 6

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

const TickStrip = React.memo(function TickStrip({
  totalTicks,
  tickStyle,
  tickLineStyle,
  tickMajorStyle,
  tickMinorStyle,
}: {
  totalTicks: number
  tickStyle: ViewStyle
  tickLineStyle: ViewStyle
  tickMajorStyle: ViewStyle
  tickMinorStyle: ViewStyle
}) {
  const ticks = useMemo(() => {
    const arr = []
    for (let i = 0; i < totalTicks; i++) {
      arr.push(
        <View key={i} style={tickStyle}>
          <View style={[tickLineStyle, i % 10 === 0 ? tickMajorStyle : tickMinorStyle]} />
        </View>,
      )
    }
    return arr
  }, [totalTicks, tickStyle, tickLineStyle, tickMajorStyle, tickMinorStyle])

  return <>{ticks}</>
})

export function RulerPicker({
  value,
  onValueChange,
  min,
  max,
  step,
  dragMultiplier = 1,
  label,
  unit,
}: RulerPickerProps) {
  const colors = useThemedColors()
  const { width } = useWindowDimensions()
  const rulerWidth = Math.max(0, width - 16)
  const sidePadding = Math.max(0, (rulerWidth - TICK_WIDTH) / 2)

  const clampValue = useCallback(
    (next: number) => {
      const snapped = min + Math.round((next - min) / step) * step
      return clamp(snapped, min, max)
    },
    [max, min, step],
  )

  const [displayValue, setDisplayValue] = useState(() => clampValue(value))
  const draftValueRef = useRef(displayValue)
  const gestureStartValueRef = useRef(displayValue)
  const isPanningRef = useRef(false)
  const ignorePropsUntilRef = useRef(0)
  const pendingValueRef = useRef<number | null>(null)
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const momentumRafRef = useRef<number | null>(null)
  const momentumVelocityRef = useRef(0)
  const momentumLastFrameRef = useRef<number | null>(null)

  const totalTicks = Math.floor((max - min) / step) + 1

  const offsetForValue = useCallback(
    (v: number) => Math.round((clamp(v, min, max) - min) / step) * TICK_WIDTH,
    [min, max, step],
  )

  const translateX = useRef(new Animated.Value(-offsetForValue(displayValue))).current

  const syncTranslateX = useCallback(
    (v: number) => {
      translateX.setValue(-offsetForValue(v))
    },
    [offsetForValue, translateX],
  )

  useEffect(() => {
    if (isPanningRef.current || Date.now() < ignorePropsUntilRef.current) return
    const next = clampValue(value)
    if (next !== draftValueRef.current) {
      draftValueRef.current = next
      setDisplayValue(next)
      syncTranslateX(next)
    }
  }, [clampValue, value, syncTranslateX])

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

  const stopMomentum = useCallback(() => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current)
      momentumRafRef.current = null
    }
    momentumVelocityRef.current = 0
    momentumLastFrameRef.current = null
  }, [])

  const setNextValue = useCallback(
    (next: number) => {
      const clamped = clampValue(next)
      if (clamped === draftValueRef.current) return

      draftValueRef.current = clamped
      syncTranslateX(clamped)
      setDisplayValue(clamped)

      pendingValueRef.current = clamped
      if (!throttleTimeoutRef.current) {
        throttleTimeoutRef.current = setTimeout(flushValueChange, 32)
      }
    },
    [clampValue, flushValueChange, syncTranslateX],
  )

  const startMomentum = useCallback(
    (velocityX: number) => {
      stopMomentum()

      const initialValueVelocity =
        ((-velocityX * 1000) / TICK_WIDTH) * dragMultiplier * step

      if (Math.abs(initialValueVelocity) < MOMENTUM_STOP_SPEED) return

      momentumVelocityRef.current = initialValueVelocity
      momentumLastFrameRef.current = null

      let fractionalValue = draftValueRef.current

      const tick = (timestamp: number) => {
        const lastTimestamp = momentumLastFrameRef.current
        momentumLastFrameRef.current = timestamp

        if (lastTimestamp === null) {
          momentumRafRef.current = requestAnimationFrame(tick)
          return
        }

        const dt = Math.min(48, timestamp - lastTimestamp)
        const decay = Math.pow(MOMENTUM_DECAY_PER_FRAME, dt / (1000 / 60))
        momentumVelocityRef.current *= decay

        if (Math.abs(momentumVelocityRef.current) < MOMENTUM_STOP_SPEED) {
          stopMomentum()
          flushValueChange()
          return
        }

        fractionalValue += (momentumVelocityRef.current * dt) / 1000
        const clampedFrac = clamp(fractionalValue, min, max)
        fractionalValue = clampedFrac

        translateX.setValue(-((clampedFrac - min) / step) * TICK_WIDTH)

        const snapped = clampValue(clampedFrac)
        if (snapped !== draftValueRef.current) {
          draftValueRef.current = snapped
          setDisplayValue(snapped)
          pendingValueRef.current = snapped
          if (!throttleTimeoutRef.current) {
            throttleTimeoutRef.current = setTimeout(flushValueChange, 32)
          }
        }

        if (
          (clampedFrac <= min && momentumVelocityRef.current < 0) ||
          (clampedFrac >= max && momentumVelocityRef.current > 0)
        ) {
          stopMomentum()
          syncTranslateX(draftValueRef.current)
          flushValueChange()
          return
        }

        momentumRafRef.current = requestAnimationFrame(tick)
      }

      momentumRafRef.current = requestAnimationFrame(tick)
    },
    [
      clampValue,
      dragMultiplier,
      flushValueChange,
      max,
      min,
      step,
      stopMomentum,
      syncTranslateX,
      translateX,
    ],
  )

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          const absX = Math.abs(gestureState.dx)
          const absY = Math.abs(gestureState.dy)
          return absX > DIRECTION_LOCK_THRESHOLD && absX > absY * 1.5
        },
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          const absX = Math.abs(gestureState.dx)
          const absY = Math.abs(gestureState.dy)
          return absX > DIRECTION_LOCK_THRESHOLD && absX > absY * 1.5
        },
        onPanResponderTerminationRequest: (_event, gestureState) => {
          const absX = Math.abs(gestureState.dx)
          return absX <= DIRECTION_LOCK_THRESHOLD
        },
        onPanResponderGrant: () => {
          stopMomentum()
          isPanningRef.current = true
          gestureStartValueRef.current = draftValueRef.current
        },
        onPanResponderMove: (_event, gestureState) => {
          const rawDelta = (-gestureState.dx / TICK_WIDTH) * dragMultiplier
          const fractional = gestureStartValueRef.current + rawDelta * step
          const clampedFrac = clamp(fractional, min, max)

          translateX.setValue(-((clampedFrac - min) / step) * TICK_WIDTH)

          const snapped = clampValue(clampedFrac)
          if (snapped !== draftValueRef.current) {
            draftValueRef.current = snapped
            setDisplayValue(snapped)
            pendingValueRef.current = snapped
            if (!throttleTimeoutRef.current) {
              throttleTimeoutRef.current = setTimeout(flushValueChange, 32)
            }
          }
        },
        onPanResponderRelease: (event, gestureState) => {
          isPanningRef.current = false
          ignorePropsUntilRef.current = Date.now() + 250

          const wasTap =
            Math.abs(gestureState.dx) < TAP_SLOP &&
            Math.abs(gestureState.dy) < TAP_SLOP

          if (wasTap) {
            const loc = event.nativeEvent as { locationX?: number }
            const distanceFromCenter = (loc.locationX ?? 0) - rulerWidth / 2
            const tickDelta = Math.round(distanceFromCenter / TICK_WIDTH)
            setNextValue(draftValueRef.current + tickDelta * step)
          }

          syncTranslateX(draftValueRef.current)

          if (throttleTimeoutRef.current) {
            clearTimeout(throttleTimeoutRef.current)
          }
          flushValueChange()

          if (!wasTap) {
            startMomentum(gestureState.vx)
          }
        },
        onPanResponderTerminate: () => {
          isPanningRef.current = false
          ignorePropsUntilRef.current = Date.now() + 250
          gestureStartValueRef.current = draftValueRef.current

          stopMomentum()
          syncTranslateX(draftValueRef.current)
          if (throttleTimeoutRef.current) {
            clearTimeout(throttleTimeoutRef.current)
          }
          flushValueChange()
        },
      }),
    [
      clampValue,
      dragMultiplier,
      flushValueChange,
      max,
      min,
      rulerWidth,
      setNextValue,
      startMomentum,
      step,
      stopMomentum,
      syncTranslateX,
      translateX,
    ],
  )

  useEffect(() => {
    return () => {
      stopMomentum()
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
      }
    }
  }, [stopMomentum])

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
    [colors, rulerWidth, sidePadding],
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{displayValue}</Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>
      </View>

      <View style={styles.rulerContainer}>
        <Animated.View
          style={[styles.rulerContent, { transform: [{ translateX }] }]}
        >
          <TickStrip
            totalTicks={totalTicks}
            tickStyle={styles.tick}
            tickLineStyle={styles.tickLine}
            tickMajorStyle={styles.tickMajor}
            tickMinorStyle={styles.tickMinor}
          />
        </Animated.View>
        <View style={styles.indicator} pointerEvents="none" />
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
      </View>
    </View>
  )
}
