import React, { createContext, useContext, useRef, useCallback } from 'react'

type ScrollToOffsetTarget = {
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void
}

interface ScrollToTopContextType {
  registerScrollRef: (
    routeName: string,
    ref: React.RefObject<ScrollToOffsetTarget | null>,
  ) => void
  scrollToTop: (routeName: string) => void
}

const ScrollToTopContext = createContext<ScrollToTopContextType | undefined>(
  undefined
)

export function ScrollToTopProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const scrollRefs = useRef<
    Map<string, React.RefObject<ScrollToOffsetTarget | null>>
  >(new Map())

  const registerScrollRef = useCallback(
    (
      routeName: string,
      ref: React.RefObject<ScrollToOffsetTarget | null>,
    ) => {
      scrollRefs.current.set(routeName, ref)
    },
    [],
  )

  const scrollToTop = useCallback(
    (routeName: string) => {
      const ref = scrollRefs.current.get(routeName)
      if (ref?.current) {
        ref.current.scrollToOffset({ offset: 0, animated: true })
      }
    },
    []
  )

  return (
    <ScrollToTopContext.Provider value={{ registerScrollRef, scrollToTop }}>
      {children}
    </ScrollToTopContext.Provider>
  )
}

export function useScrollToTop() {
  const context = useContext(ScrollToTopContext)
  if (context === undefined) {
    throw new Error('useScrollToTop must be used within ScrollToTopProvider')
  }
  return context
}
