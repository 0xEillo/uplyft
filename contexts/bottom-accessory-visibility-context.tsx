import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
} from 'react'
import { Animated } from 'react-native'

const HIDE_DELTA_PX = 8
const SHOW_DELTA_PX = 4
const TOP_REVEAL_PX = 60
const ANIM_DURATION_MS = 220

interface BottomAccessoryVisibilityContextType {
  hideProgress: Animated.Value
  reportScrollY: (y: number) => void
  resetVisibility: () => void
}

const Ctx = createContext<BottomAccessoryVisibilityContextType | undefined>(
  undefined,
)

export function BottomAccessoryVisibilityProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const hideProgress = useRef(new Animated.Value(0)).current
  const lastY = useRef(0)
  const isHiddenRef = useRef(false)
  const animRef = useRef<Animated.CompositeAnimation | null>(null)

  const animateTo = useCallback(
    (toValue: number) => {
      if (animRef.current) animRef.current.stop()
      animRef.current = Animated.timing(hideProgress, {
        toValue,
        duration: ANIM_DURATION_MS,
        useNativeDriver: true,
      })
      animRef.current.start()
    },
    [hideProgress],
  )

  const reportScrollY = useCallback(
    (y: number) => {
      const delta = y - lastY.current
      lastY.current = y

      if (y < TOP_REVEAL_PX) {
        if (isHiddenRef.current) {
          isHiddenRef.current = false
          animateTo(0)
        }
        return
      }

      if (delta > HIDE_DELTA_PX && !isHiddenRef.current) {
        isHiddenRef.current = true
        animateTo(1)
      } else if (delta < -SHOW_DELTA_PX && isHiddenRef.current) {
        isHiddenRef.current = false
        animateTo(0)
      }
    },
    [animateTo],
  )

  const resetVisibility = useCallback(() => {
    lastY.current = 0
    if (isHiddenRef.current) {
      isHiddenRef.current = false
      animateTo(0)
    }
  }, [animateTo])

  return (
    <Ctx.Provider value={{ hideProgress, reportScrollY, resetVisibility }}>
      {children}
    </Ctx.Provider>
  )
}

export function useBottomAccessoryVisibility() {
  return useContext(Ctx)
}
