import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type SerializableTimerState = {
  timerStartedAt: string | null
  timerElapsedSeconds: number
}

export function useWorkoutTimer() {
  const [elapsedBaseSeconds, setElapsedBaseSeconds] = useState(0)
  const [startTimestamp, setStartTimestamp] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimestampRef = useRef<number | null>(null)

  const clearIntervalRef = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => {
    startTimestampRef.current = startTimestamp
  }, [startTimestamp])

  const updateElapsedFromNow = useCallback(() => {
    if (!startTimestamp) {
      setElapsedSeconds(elapsedBaseSeconds)
      return
    }

    const delta = Math.floor((Date.now() - startTimestamp) / 1000)
    setElapsedSeconds(elapsedBaseSeconds + Math.max(0, delta))
  }, [elapsedBaseSeconds, startTimestamp])

  useEffect(() => {
    clearIntervalRef()

    if (startTimestamp) {
      updateElapsedFromNow()
      intervalRef.current = setInterval(() => {
        updateElapsedFromNow()
      }, 1000)
    }

    return clearIntervalRef
  }, [startTimestamp, updateElapsedFromNow])

  const start = useCallback(() => {
    setStartTimestamp((current) => {
      if (current) return current
      return Date.now()
    })
  }, [])

  const pause = useCallback(() => {
    setElapsedBaseSeconds((prev) => {
      const currentStart = startTimestampRef.current
      if (!currentStart) {
        return prev
      }
      const deltaSeconds = Math.floor((Date.now() - currentStart) / 1000)
      const next = prev + Math.max(0, deltaSeconds)
      setElapsedSeconds(next)
      return next
    })
    setStartTimestamp(null)
  }, [])

  const reset = useCallback(() => {
    setStartTimestamp(null)
    setElapsedBaseSeconds(0)
    setElapsedSeconds(0)
  }, [])

  const hydrate = useCallback(
    (startIso: string | null, baseSeconds: number = 0) => {
      setElapsedBaseSeconds(Math.max(0, Math.floor(baseSeconds)))

      if (startIso) {
        const startMs = Date.parse(startIso)
        if (!Number.isNaN(startMs)) {
          setStartTimestamp(startMs)
          return
        }
      }

      setStartTimestamp(null)
      setElapsedSeconds(Math.max(0, Math.floor(baseSeconds)))
    },
    [],
  )

  const getElapsedSeconds = useCallback(() => elapsedSeconds, [elapsedSeconds])

  const serializableState: SerializableTimerState = useMemo(
    () => ({
      timerStartedAt: startTimestamp
        ? new Date(startTimestamp).toISOString()
        : null,
      timerElapsedSeconds: elapsedBaseSeconds,
    }),
    [elapsedBaseSeconds, startTimestamp],
  )

  return {
    elapsedSeconds,
    isRunning: Boolean(startTimestamp),
    start,
    pause,
    reset,
    hydrate,
    getElapsedSeconds,
    serializableState,
  }
}
