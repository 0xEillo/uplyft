interface PrInfoWithDetails {
  prDetails?: readonly unknown[] | null
}

export function countWorkoutRecords(
  prInfo: readonly PrInfoWithDetails[],
): number {
  return prInfo.reduce(
    (total, exercisePr) => total + (exercisePr.prDetails?.length ?? 0),
    0,
  )
}
