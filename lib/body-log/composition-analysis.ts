/**
 * Body Composition Analysis
 * Analyzes body metrics against aesthetic and health guidelines
 */

export type Gender = 'male' | 'female'

export interface BodyFatRange {
  category: string
  label: string
  description: string
  color: 'optimal' | 'building' | 'moderate' | 'high'
  icon: string
  recommendation: string
}

export interface BMIRange {
  category: string
  label: string
  description: string
  color: 'optimal' | 'building' | 'moderate' | 'high'
  icon: string
  recommendation: string
}

export interface OverallStatus {
  title: string
  summary: string
  color: 'optimal' | 'building' | 'moderate' | 'high'
}

/**
 * Get body fat percentage status and recommendations
 */
export function getBodyFatStatus(
  bodyFat: number | null,
  gender: Gender,
): BodyFatRange | null {
  if (bodyFat === null) return null

  if (gender === 'male') {
    if (bodyFat < 7) {
      return {
        category: 'Very Low',
        label: 'Extremely Lean',
        description:
          'Exceptional leanness with high vascularity. May compromise sustainability.',
        color: 'moderate',
        icon: 'warning',
        recommendation:
          'Increase calories slightly to maintain muscle and hormonal health.',
      }
    } else if (bodyFat >= 7 && bodyFat <= 12) {
      return {
        category: 'Aesthetic Ideal',
        label: 'Peak Conditioning',
        description:
          'Optimal aesthetic appeal with clear ab definition and muscle firmness.',
        color: 'optimal',
        icon: 'trophy',
        recommendation:
          'Maintain through strength training and adequate protein intake.',
      }
    } else if (bodyFat > 12 && bodyFat <= 15) {
      return {
        category: 'Moderate',
        label: 'Good Shape',
        description: 'Some ab definition with reduced muscle sharpness.',
        color: 'building',
        icon: 'fitness',
        recommendation:
          'Mild caloric deficit and increased activity to reach 8-12%.',
      }
    } else if (bodyFat > 15 && bodyFat <= 20) {
      return {
        category: 'High',
        label: 'Building Phase',
        description: 'Minimal definition. Focus on body composition improvement.',
        color: 'moderate',
        icon: 'trending-up',
        recommendation:
          'Implement caloric deficit and strength training to improve definition.',
      }
    } else {
      return {
        category: 'Very High',
        label: 'Early Journey',
        description: 'Significant opportunity for transformation and improvement.',
        color: 'high',
        icon: 'barbell',
        recommendation:
          'Start with moderate caloric deficit and consistent daily activity.',
      }
    }
  } else {
    // Female
    if (bodyFat < 15) {
      return {
        category: 'Very Low',
        label: 'Very Athletic',
        description:
          'High muscle definition. May impact hormonal health if sustained.',
        color: 'moderate',
        icon: 'warning',
        recommendation:
          'Increase calories to support hormonal balance and energy levels.',
      }
    } else if (bodyFat >= 15 && bodyFat <= 22) {
      return {
        category: 'Aesthetic Ideal',
        label: 'Peak Conditioning',
        description:
          'Optimal balance of muscle tone, definition, and feminine curves.',
        color: 'optimal',
        icon: 'trophy',
        recommendation:
          'Maintain with strength training and balanced nutrition.',
      }
    } else if (bodyFat > 22 && bodyFat <= 25) {
      return {
        category: 'Moderate',
        label: 'Good Shape',
        description: 'Healthy range with soft muscle definition.',
        color: 'building',
        icon: 'fitness',
        recommendation: 'Mild caloric deficit to reach 16-22% for more tone.',
      }
    } else if (bodyFat > 25 && bodyFat <= 30) {
      return {
        category: 'High',
        label: 'Building Phase',
        description: 'Focus on building muscle and improving body composition.',
        color: 'moderate',
        icon: 'trending-up',
        recommendation:
          'Combine strength training with moderate caloric deficit.',
      }
    } else {
      return {
        category: 'Very High',
        label: 'Early Journey',
        description: 'Great starting point for meaningful transformation.',
        color: 'high',
        icon: 'barbell',
        recommendation:
          'Begin with consistent activity and moderate caloric deficit.',
      }
    }
  }
}

/**
 * Get BMI status and recommendations
 */
export function getBMIStatus(
  bmi: number | null,
  gender: Gender,
): BMIRange | null {
  if (bmi === null) return null

  if (gender === 'male') {
    if (bmi < 18.5) {
      return {
        category: 'Underweight',
        label: 'Build Muscle',
        description: 'Low muscle mass. Focus on building strength and size.',
        color: 'moderate',
        icon: 'arrow-up',
        recommendation:
          'Gain muscle through strength training and caloric surplus.',
      }
    } else if (bmi >= 18.5 && bmi < 22) {
      return {
        category: 'Healthy Low',
        label: 'Foundation',
        description: 'Healthy but minimal muscle. Room for aesthetic improvement.',
        color: 'building',
        icon: 'construct',
        recommendation: 'Build muscle to reach 24-26 BMI for optimal aesthetics.',
      }
    } else if (bmi >= 22 && bmi < 24) {
      return {
        category: 'Aesthetic Build-Up',
        label: 'Progressing',
        description: 'Good foundation. Continue building toward peak.',
        color: 'building',
        icon: 'trending-up',
        recommendation: 'Gain 1-2 lbs muscle per month to reach aesthetic peak.',
      }
    } else if (bmi >= 24 && bmi <= 26) {
      return {
        category: 'Aesthetic Peak',
        label: 'Ideal Physique',
        description:
          'Optimal muscle mass and proportion. Maintain this range.',
        color: 'optimal',
        icon: 'trophy',
        recommendation:
          'Maintain leanness and strength. This is your peak aesthetic range.',
      }
    } else if (bmi > 26 && bmi <= 30) {
      return {
        category: 'Above Peak',
        label: 'Reassess',
        description: 'May have excess muscle or fat. Check body fat percentage.',
        color: 'moderate',
        icon: 'analytics',
        recommendation:
          'If body fat is high (>15%), focus on fat loss to return to 24-26 BMI.',
      }
    } else {
      return {
        category: 'Overweight',
        label: 'Fat Loss Focus',
        description: 'Significant fat gain. Prioritize body composition.',
        color: 'high',
        icon: 'flame',
        recommendation:
          'Implement caloric deficit and daily activity to reach 24-26 BMI.',
      }
    }
  } else {
    // Female
    if (bmi < 18.5) {
      return {
        category: 'Underweight',
        label: 'Build Tone',
        description: 'Low muscle and/or body fat. Focus on building strength.',
        color: 'moderate',
        icon: 'arrow-up',
        recommendation:
          'Gain muscle through strength training and adequate nutrition.',
      }
    } else if (bmi >= 18.5 && bmi < 20) {
      return {
        category: 'Healthy Low',
        label: 'Foundation',
        description: 'Healthy but minimal muscle tone. Room for development.',
        color: 'building',
        icon: 'construct',
        recommendation:
          'Build muscle tone to reach 22-23 BMI for optimal aesthetics.',
      }
    } else if (bmi >= 20 && bmi < 22) {
      return {
        category: 'Aesthetic Build-Up',
        label: 'Progressing',
        description: 'Good foundation with balanced proportions.',
        color: 'building',
        icon: 'trending-up',
        recommendation:
          'Continue building muscle to reach 22-23 BMI aesthetic peak.',
      }
    } else if (bmi >= 22 && bmi <= 23) {
      return {
        category: 'Aesthetic Peak',
        label: 'Ideal Physique',
        description: 'Optimal balance of muscle tone, curves, and leanness.',
        color: 'optimal',
        icon: 'trophy',
        recommendation:
          'Maintain this range with strength training and balanced nutrition.',
      }
    } else if (bmi > 23 && bmi <= 25) {
      return {
        category: 'Above Peak',
        label: 'Reassess',
        description: 'Check body fat percentage to guide next steps.',
        color: 'moderate',
        icon: 'analytics',
        recommendation:
          'If body fat is high (>22%), focus on fat loss to reach 22-23 BMI.',
      }
    } else {
      return {
        category: 'Overweight',
        label: 'Fat Loss Focus',
        description: 'Prioritize body composition and activity.',
        color: 'high',
        icon: 'flame',
        recommendation:
          'Implement moderate caloric deficit and daily movement to reach 22-23 BMI.',
      }
    }
  }
}

/**
 * Get overall physique status combining body fat and BMI
 */
export function getOverallStatus(
  bodyFat: number | null,
  bmi: number | null,
  gender: Gender,
): OverallStatus | null {
  const bodyFatStatus = getBodyFatStatus(bodyFat, gender)
  const bmiStatus = getBMIStatus(bmi, gender)

  // If both metrics are missing, return null
  if (!bodyFatStatus && !bmiStatus) return null

  // Prioritize body fat status if both available, otherwise use BMI
  const primaryStatus = bodyFatStatus || bmiStatus

  if (!primaryStatus) return null

  // Determine overall status based on color priority
  if (primaryStatus.color === 'optimal') {
    return {
      title: 'Peak Conditioning',
      summary:
        'Your physique is in optimal aesthetic range. Keep up the great work!',
      color: 'optimal',
    }
  } else if (primaryStatus.color === 'building') {
    return {
      title: 'Building Phase',
      summary:
        'You are making solid progress. Stay consistent with training and nutrition.',
      color: 'building',
    }
  } else if (primaryStatus.color === 'moderate') {
    return {
      title: 'Room for Improvement',
      summary:
        'Focus on body composition to reach your aesthetic potential.',
      color: 'moderate',
    }
  } else {
    return {
      title: 'Early Journey',
      summary:
        'Great starting point! Consistency with training and nutrition will yield results.',
      color: 'high',
    }
  }
}

/**
 * Get color scheme for status indicators
 */
export function getStatusColor(
  color: 'optimal' | 'building' | 'moderate' | 'high',
): {
  primary: string
  background: string
  text: string
} {
  switch (color) {
    case 'optimal':
      return {
        primary: '#10B981', // Green
        background: 'rgba(16, 185, 129, 0.12)',
        text: '#059669',
      }
    case 'building':
      return {
        primary: '#3B82F6', // Blue
        background: 'rgba(59, 130, 246, 0.12)',
        text: '#2563EB',
      }
    case 'moderate':
      return {
        primary: '#F59E0B', // Amber
        background: 'rgba(245, 158, 11, 0.12)',
        text: '#D97706',
      }
    case 'high':
      return {
        primary: '#EF4444', // Red
        background: 'rgba(239, 68, 68, 0.12)',
        text: '#DC2626',
      }
  }
}

/**
 * Get metric explanation for info modal
 */
export function getBodyFatExplanation(gender: Gender): string {
  if (gender === 'male') {
    return 'Body fat percentage measures the proportion of fat relative to total body weight. For men, 8-12% is the aesthetic ideal with clear ab definition and muscle firmness.'
  } else {
    return 'Body fat percentage measures the proportion of fat relative to total body weight. For women, 16-22% is the aesthetic ideal with visible muscle tone and balanced curves.'
  }
}

export function getBMIExplanation(gender: Gender): string {
  if (gender === 'male') {
    return 'BMI calculates weight relative to height. For aesthetic appeal, men should aim for 24-26 BMI with low body fat (8-12%), indicating optimal muscle mass and proportion.'
  } else {
    return 'BMI calculates weight relative to height. For aesthetic appeal, women should aim for 22-23 BMI with 16-22% body fat, indicating optimal muscle tone and curves.'
  }
}

export function getWeightExplanation(gender: Gender): string {
  return `Your body weight in ${gender === 'male' ? 'the context of height and body composition' : 'relation to muscle tone and body fat'}. Combined with BMI and body fat percentage, it helps track your physique progress over time.`
}
