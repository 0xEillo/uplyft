export function formatWeightInputValue(
  weight: number | null | undefined,
): string | null {
  if (weight === null || weight === undefined || !Number.isFinite(weight)) {
    return null
  }

  return Number(weight.toFixed(2)).toString()
}
