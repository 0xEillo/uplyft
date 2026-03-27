import type { ImageSourcePropType } from 'react-native'

/** Local branded artwork for preset explore programs (PNG on theme-colored surface). */
const IMAGE_5X5 = require('../assets/images/5x5.png')
const IMAGE_PUSH_PULL_LEGS = require('../assets/images/program-push-pull-legs.png')
const IMAGE_UPPER_LOWER = require('../assets/images/program-upper-lower.png')
const IMAGE_FULL_BODY = require('../assets/images/program-full-body.png')
const IMAGE_ARNOLD_SPLIT = require('../assets/images/program-arnold-split.png')
const IMAGE_BODY_BASICS = require('../assets/images/program-body-basics.png')

function normalizeProgramName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const BRANDED: { match: (normalized: string) => boolean; image: ImageSourcePropType }[] = [
  { match: (n) => /5\s*[x×]\s*5/.test(n), image: IMAGE_5X5 },
  { match: (n) => n === 'push pull legs', image: IMAGE_PUSH_PULL_LEGS },
  { match: (n) => n === 'upper lower split', image: IMAGE_UPPER_LOWER },
  { match: (n) => n === 'full body foundation', image: IMAGE_FULL_BODY },
  { match: (n) => n === 'arnold split', image: IMAGE_ARNOLD_SPLIT },
  { match: (n) => n === 'bodyweight basics', image: IMAGE_BODY_BASICS },
]

/**
 * Returns bundled image for explore programs with custom card art, or null to use the default gradient + title.
 */
export function getBrandedProgramImageSource(
  name: string,
): ImageSourcePropType | null {
  const n = normalizeProgramName(name)
  for (const { match, image } of BRANDED) {
    if (match(n)) return image
  }
  return null
}
