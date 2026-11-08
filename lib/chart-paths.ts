/**
 * Monotone cubic Hermite interpolation (Fritsch–Carlson method).
 * Guarantees no overshooting between data points — produces clean,
 * professional curves even with sparse or volatile data.
 */
export function buildSmoothPath(points: { x: number; y: number }[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M ${points[0].x} ${points[0].y}`
  if (n === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

  // 1. Compute slopes of secant lines between successive points
  const dx: number[] = []
  const dy: number[] = []
  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x)
    dy.push(points[i + 1].y - points[i].y)
    slopes.push(dx[i] === 0 ? 0 : dy[i] / dx[i])
  }

  // 2. Compute initial tangents using average of adjacent slopes
  const tangents: number[] = [slopes[0]]
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      // Sign change or zero — flat tangent to prevent overshoot
      tangents.push(0)
    } else {
      // Harmonic mean of adjacent slopes (better monotonicity)
      tangents.push(
        2 / (1 / slopes[i - 1] + 1 / slopes[i])
      )
    }
  }
  tangents.push(slopes[n - 2])

  // 3. Fritsch–Carlson correction to ensure monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slopes[i]) < 1e-10) {
      tangents[i] = 0
      tangents[i + 1] = 0
    } else {
      const alpha = tangents[i] / slopes[i]
      const beta = tangents[i + 1] / slopes[i]
      // Restrict to a circle of radius 3 to ensure monotonicity
      const mag = Math.sqrt(alpha * alpha + beta * beta)
      if (mag > 3) {
        const tau = 3 / mag
        tangents[i] = tau * alpha * slopes[i]
        tangents[i + 1] = tau * beta * slopes[i]
      }
    }
  }

  // 4. Build cubic Bézier path from Hermite tangents
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const segLen = dx[i] / 3
    const cp1x = points[i].x + segLen
    const cp1y = points[i].y + tangents[i] * segLen
    const cp2x = points[i + 1].x - segLen
    const cp2y = points[i + 1].y - tangents[i + 1] * segLen
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i + 1].x} ${points[i + 1].y}`
  }

  return d
}
