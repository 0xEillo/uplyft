import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'

export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeContextType {
  themePreference: ThemePreference
  setThemePreference: (theme: ThemePreference) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_KEY = '@app_theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme()
  const [themePreference, setThemeState] = useState<ThemePreference>('system')

  useEffect(() => {
    loadTheme()
  }, [])

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_KEY)
      if (
        savedTheme === 'dark' ||
        savedTheme === 'light' ||
        savedTheme === 'system'
      ) {
        setThemeState(savedTheme as ThemePreference)
      } else {
        // Default to system if no preference saved
        setThemeState('system')
      }
    } catch (error) {
      console.error('Error loading theme:', error)
    }
  }

  const setThemePreference = async (newTheme: ThemePreference) => {
    try {
      setThemeState(newTheme)
      await AsyncStorage.setItem(THEME_KEY, newTheme)
    } catch (error) {
      console.error('Error saving theme:', error)
    }
  }

  const isDark =
    themePreference === 'system'
      ? systemColorScheme === 'dark'
      : themePreference === 'dark'

  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        setThemePreference,
        isDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
