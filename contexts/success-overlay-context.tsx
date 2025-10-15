import React, { createContext, useContext, useState } from 'react'

interface SuccessOverlayData {
  message: string
  workoutNumber: number
  weeklyTarget: number
}

interface SuccessOverlayContextType {
  showOverlay: (data: SuccessOverlayData) => void
  hideOverlay: () => void
  isVisible: boolean
  data: SuccessOverlayData
}

const SuccessOverlayContext = createContext<
  SuccessOverlayContextType | undefined
>(undefined)

export function SuccessOverlayProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [data, setData] = useState<SuccessOverlayData>({
    message: 'Well done on completing another workout!',
    workoutNumber: 1,
    weeklyTarget: 3,
  })

  const showOverlay = (overlayData: SuccessOverlayData) => {
    setData(overlayData)
    setIsVisible(true)
  }

  const hideOverlay = () => {
    setIsVisible(false)
  }

  return (
    <SuccessOverlayContext.Provider
      value={{
        showOverlay,
        hideOverlay,
        isVisible,
        data,
      }}
    >
      {children}
    </SuccessOverlayContext.Provider>
  )
}

export function useSuccessOverlay() {
  const context = useContext(SuccessOverlayContext)
  if (context === undefined) {
    throw new Error(
      'useSuccessOverlay must be used within a SuccessOverlayProvider',
    )
  }
  return context
}
