import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react'

interface TabBarVisibilityContextType {
  hideForFullscreenOverlay: boolean
  setHideForFullscreenOverlay: (hide: boolean) => void
}

const TabBarVisibilityContext = createContext<
  TabBarVisibilityContextType | undefined
>(undefined)

export function TabBarVisibilityProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [hideForFullscreenOverlay, setHideForFullscreenOverlay] =
    useState(false)

  const setHide = useCallback((hide: boolean) => {
    setHideForFullscreenOverlay(hide)
  }, [])

  return (
    <TabBarVisibilityContext.Provider
      value={{ hideForFullscreenOverlay, setHideForFullscreenOverlay: setHide }}
    >
      {children}
    </TabBarVisibilityContext.Provider>
  )
}

export function useTabBarVisibility() {
  return useContext(TabBarVisibilityContext)
}
