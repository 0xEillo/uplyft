import { useMemo } from 'react'
import {
  PACKAGE_TYPE,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases'

const YEARLY_IDENTIFIER_REGEX = /year|annual/i
const LIFETIME_IDENTIFIER_REGEX = /lifetime|forever/i

const findByType = (
  packages: PurchasesPackage[],
  type: PACKAGE_TYPE,
): PurchasesPackage | undefined =>
  packages.find((pkg) => pkg.packageType === type)

const findByIdentifier = (
  packages: PurchasesPackage[],
  regex: RegExp,
): PurchasesPackage | undefined =>
  packages.find((pkg) => regex.test(pkg.identifier))

export function useRevenueCatPackages(offerings: PurchasesOffering | null) {
  return useMemo(() => {
    if (!offerings) {
      return {
        monthly: null,
        yearly: null,
        lifetime: null,
        available: [],
      }
    }

    const available = offerings.availablePackages ?? []

    const monthly =
      offerings.monthly ?? findByType(available, PACKAGE_TYPE.MONTHLY) ?? null

    const yearly =
      offerings.annual ??
      findByType(available, PACKAGE_TYPE.ANNUAL) ??
      findByIdentifier(available, YEARLY_IDENTIFIER_REGEX) ??
      null

    const lifetime =
      offerings.lifetime ??
      findByType(available, PACKAGE_TYPE.LIFETIME) ??
      findByIdentifier(available, LIFETIME_IDENTIFIER_REGEX) ??
      null

    return {
      monthly,
      yearly,
      lifetime,
      available,
    }
  }, [offerings])
}

export function calculateYearlySavings(
  monthly: PurchasesPackage | null,
  yearly: PurchasesPackage | null,
) {
  if (!monthly || !yearly) return null
  const monthlyPrice = monthly.product.price
  const yearlyPrice = yearly.product.price
  if (!monthlyPrice || monthlyPrice <= 0 || !yearlyPrice || yearlyPrice <= 0)
    return null

  const annualizedMonthly = monthlyPrice * 12
  if (annualizedMonthly <= 0) return null

  const savings = ((annualizedMonthly - yearlyPrice) / annualizedMonthly) * 100
  return Math.max(0, Math.round(savings))
}

