import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

type WeightUnit = 'kg' | 'lb'

interface UnitContextValue {
  weightUnit: WeightUnit
  setWeightUnit: (unit: WeightUnit) => void
  convertToPreferred: (kg: number | null | undefined) => number | null
  convertInputToKg: (value: number | null | undefined) => number | null
  formatWeight: (
    valueKg: number | null | undefined,
    options?: Intl.NumberFormatOptions,
  ) => string
}

const UnitContext = createContext<UnitContextValue | undefined>(undefined)

const WEIGHT_UNIT_KEY = '@preference_weight_unit'
const KG_TO_LB = 2.2046226218

const numberFormatter = (options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    ...options,
  })

export function formatWeightValue(
  valueKg: number | null | undefined,
  unit: WeightUnit,
  options?: Intl.NumberFormatOptions,
): string {
  if (valueKg === null || valueKg === undefined || Number.isNaN(valueKg)) {
    return 'BW'
  }
  const converted = kgToPreferred(valueKg, unit)
  const formatter = numberFormatter({
    maximumFractionDigits: unit === 'kg' ? 1 : 0,
    ...options,
  })
  const unitSuffix = unit === 'kg' ? 'kg' : 'lb'
  return `${formatter.format(converted)} ${unitSuffix}`
}

export function UnitProvider({ children }: PropsWithChildren) {
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('kg')

  useEffect(() => {
    const loadUnit = async () => {
      try {
        const stored = await AsyncStorage.getItem(WEIGHT_UNIT_KEY)
        if (stored === 'kg' || stored === 'lb') {
          setWeightUnitState(stored)
        }
      } catch (error) {
        console.warn('Failed to load weight unit preference', error)
      }
    }

    loadUnit()
  }, [])

  const persistUnit = useCallback(async (unit: WeightUnit) => {
    try {
      await AsyncStorage.setItem(WEIGHT_UNIT_KEY, unit)
    } catch (error) {
      console.warn('Failed to persist weight unit', error)
    }
  }, [])

  const setWeightUnit = useCallback(
    (unit: WeightUnit) => {
      setWeightUnitState(unit)
      void persistUnit(unit)
    },
    [persistUnit],
  )

  const convertToPreferred = useCallback(
    (kg: number | null | undefined) => {
      if (kg === null || kg === undefined || Number.isNaN(kg)) return null
      if (weightUnit === 'kg') return kg
      return kg * KG_TO_LB
    },
    [weightUnit],
  )

  const convertInputToKg = useCallback(
    (value: number | null | undefined) => {
      if (value === null || value === undefined || Number.isNaN(value)) {
        return null
      }
      if (weightUnit === 'kg') return value
      return value / KG_TO_LB
    },
    [weightUnit],
  )

  const formatWeight = useCallback(
    (
      valueKg: number | null | undefined,
      options?: Intl.NumberFormatOptions,
    ) => {
      return formatWeightValue(valueKg, weightUnit, options)
    },
    [weightUnit],
  )

  return (
    <UnitContext.Provider
      value={{
        weightUnit,
        setWeightUnit,
        convertToPreferred,
        convertInputToKg,
        formatWeight,
      }}
    >
      {children}
    </UnitContext.Provider>
  )
}

export function useUnits() {
  const context = useContext(UnitContext)
  if (!context) {
    throw new Error('useUnits must be used within a UnitProvider')
  }
  return context
}

export function kgToPreferred(weightKg: number, unit: WeightUnit): number {
  return unit === 'kg' ? weightKg : weightKg * KG_TO_LB
}

export function preferredToKg(weight: number, unit: WeightUnit): number {
  return unit === 'kg' ? weight : weight / KG_TO_LB
}

export type { WeightUnit }
