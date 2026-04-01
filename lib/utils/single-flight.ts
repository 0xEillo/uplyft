export interface BooleanRefLike {
  current: boolean
}

export function beginSingleFlight(ref: BooleanRefLike): boolean {
  if (ref.current) {
    return false
  }

  ref.current = true
  return true
}

export function endSingleFlight(ref: BooleanRefLike): void {
  ref.current = false
}
