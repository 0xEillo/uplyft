import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import type { BodyPartSlug } from '@/lib/body-mapping'
import { useMemo } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import Body from 'react-native-body-highlighter'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface BodyData {
  slug: BodyPartSlug
  intensity: number
  side?: 'left' | 'right'
}

interface BodyHighlighterDualProps {
  bodyData: BodyData[]
  gender: 'male' | 'female'
  colors: string[]
  onBodyPartPress: (bodyPart: { slug?: string }, side?: 'left' | 'right') => void
}

/**
 * A shared component that displays front and back body views side by side.
 * Used by both StrengthBodyView and RecoveryBodyView.
 */
export function BodyHighlighterDual({
  bodyData,
  gender,
  colors: highlightColors,
  onBodyPartPress,
}: BodyHighlighterDualProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const styles = createStyles()

  // Base colors for the body parts not included in bodyData
  // In light mode, we use high contrast against the f6f6f8 background
  // In dark mode, silhouette must be visible against #000000
  // In dark mode, we need a visible silhouette against the pitch black (#000000) background
  // #2A2A2A is visible enough to define the body without being distracting
  const bodyBackColor = isDark ? '#1C1C1C' : '#E5E5EA'
  const bodyBorderColor = isDark ? '#333333' : '#D8D8DC'

  // Calculate scale to fit both bodies side by side
  const bodyScale = Math.min((SCREEN_WIDTH - 40) / 380, 1.0)

  // Slugs to hide (make them match the background)
  const HIDDEN_SLUGS: BodyPartSlug[] = ['hands', 'feet', 'ankles']
  
  // We augment the colors array with the background color at the end
  // to allow mapping "hidden" parts to it.
  const augmentedColors = [...highlightColors, colors.background]
  const hiddenIntensity = augmentedColors.length

  // Generate the augmented body data that includes hidden parts
  const augmentedBodyData = useMemo(() => {
    // Start with the provided data, but filter out any manual overrides for hidden slugs
    const filteredBase = bodyData.filter(d => !HIDDEN_SLUGS.includes(d.slug))
    
    // Add the hidden slugs with the intensity pointing to the background color
    const hiddenParts = HIDDEN_SLUGS.map(slug => ({
      slug,
      intensity: hiddenIntensity
    }))
    
    return [...filteredBase, ...hiddenParts]
  }, [bodyData, hiddenIntensity])

  return (
    <View style={styles.bodiesContainer}>
      {/* Front View */}
      <View style={styles.bodyWrapper}>
        <Body
          data={augmentedBodyData}
          gender={gender}
          side="front"
          scale={bodyScale}
          colors={augmentedColors}
          onBodyPartPress={onBodyPartPress}
          border={bodyBorderColor}
          // @ts-ignore
          baseColor={bodyBackColor}
          // @ts-ignore
          backColor={bodyBackColor}
          // @ts-ignore
          fill={bodyBackColor}
        />
      </View>

      {/* Back View */}
      <View style={styles.bodyWrapper}>
        <Body
          data={augmentedBodyData}
          gender={gender}
          side="back"
          scale={bodyScale}
          colors={augmentedColors}
          onBodyPartPress={onBodyPartPress}
          border={bodyBorderColor}
          // @ts-ignore
          baseColor={bodyBackColor}
          // @ts-ignore
          backColor={bodyBackColor}
          // @ts-ignore
          fill={bodyBackColor}
        />
      </View>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    bodiesContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: 8,
    },
    bodyWrapper: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
