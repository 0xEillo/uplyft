import React, { memo, useCallback, useMemo } from 'react'
import differenceWith from 'ramda/src/differenceWith'
import { Path } from 'react-native-svg'

import type {
  BodyPart,
  BodyProps,
  ExtendedBodyPart,
} from 'react-native-body-highlighter'
import { bodyBack } from 'react-native-body-highlighter/assets/bodyBack'
import { bodyFemaleBack } from 'react-native-body-highlighter/assets/bodyFemaleBack'
import { bodyFemaleFront } from 'react-native-body-highlighter/assets/bodyFemaleFront'
import { bodyFront } from 'react-native-body-highlighter/assets/bodyFront'
import { SvgFemaleWrapper } from 'react-native-body-highlighter/components/SvgFemaleWrapper'
import { SvgMaleWrapper } from 'react-native-body-highlighter/components/SvgMaleWrapper'

const comparison = (a: ExtendedBodyPart, b: ExtendedBodyPart) => a.slug === b.slug

function augmentCompositeHighlights(
  data: readonly ExtendedBodyPart[],
  side: 'front' | 'back',
): ExtendedBodyPart[] {
  const augmented = [...data]
  const hasSlug = (slug: ExtendedBodyPart['slug']) =>
    augmented.some((part) => part.slug === slug)
  const findSlug = (slug: ExtendedBodyPart['slug']) =>
    augmented.find((part) => part.slug === slug)
  const inherit = (
    sourceSlug: ExtendedBodyPart['slug'],
    targetSlug: ExtendedBodyPart['slug'],
  ) => {
    if (hasSlug(targetSlug)) return
    const source = findSlug(sourceSlug)
    if (!source) return
    augmented.push({
      slug: targetSlug,
      intensity: source.intensity,
      side: source.side,
    })
  }

  if (side === 'back') {
    inherit('trapezius', 'neck')
    inherit('hamstring', 'adductors')
  }

  if (side === 'front') {
    inherit('quadriceps', 'adductors')
  }

  return augmented
}

const PatchedBodyHighlighter = ({
  colors = ['#0984e3', '#74b9ff'],
  data,
  scale = 1,
  side = 'front',
  gender = 'male',
  onBodyPartPress,
  border = '#dfdfdf',
}: BodyProps) => {
  const resolvedData = useMemo(
    () => augmentCompositeHighlights(data, side),
    [data, side],
  )

  const mergedBodyParts = useCallback(
    (dataSource: readonly BodyPart[]) => {
      const innerData = resolvedData
        .map((part) => dataSource.find((entry) => entry.slug === part.slug))
        .filter(Boolean)

      const coloredBodyParts = innerData.map((part) => {
        const bodyPart = resolvedData.find((entry) => entry.slug === part?.slug)
        const colorIntensity = bodyPart?.intensity ?? 1
        return { ...part, color: colors[colorIntensity - 1] }
      })

      const formattedBodyParts = differenceWith(comparison, dataSource, resolvedData)

      return [...formattedBodyParts, ...coloredBodyParts]
    },
    [colors, resolvedData],
  )

  const getColorToFill = (bodyPart: ExtendedBodyPart) => bodyPart.color

  const renderBodySvg = (bodyToRender: readonly BodyPart[]) => {
    const SvgWrapper = gender === 'male' ? SvgMaleWrapper : SvgFemaleWrapper

    return (
      <SvgWrapper side={side} scale={scale} border={border}>
        {mergedBodyParts(bodyToRender).map((bodyPart: ExtendedBodyPart) => {
          const commonPaths = (bodyPart.path?.common || []).map((path) => {
            const dataCommonPath = resolvedData.find((d) => d.slug === bodyPart.slug)
              ?.path?.common

            return (
              <Path
                key={path}
                onPress={() => onBodyPartPress?.(bodyPart)}
                id={bodyPart.slug}
                fill={dataCommonPath ? getColorToFill(bodyPart) : bodyPart.color}
                d={path}
              />
            )
          })

          const leftPaths = (bodyPart.path?.left || []).map((path) => {
            const isOnlyRight =
              resolvedData.find((d) => d.slug === bodyPart.slug)?.side === 'right'

            return (
              <Path
                key={path}
                onPress={() => onBodyPartPress?.(bodyPart, 'left')}
                id={bodyPart.slug}
                fill={isOnlyRight ? '#3f3f3f' : getColorToFill(bodyPart)}
                d={path}
              />
            )
          })

          const rightPaths = (bodyPart.path?.right || []).map((path) => {
            const isOnlyLeft =
              resolvedData.find((d) => d.slug === bodyPart.slug)?.side === 'left'

            return (
              <Path
                key={path}
                onPress={() => onBodyPartPress?.(bodyPart, 'right')}
                id={bodyPart.slug}
                fill={isOnlyLeft ? '#3f3f3f' : getColorToFill(bodyPart)}
                d={path}
              />
            )
          })

          return [...commonPaths, ...leftPaths, ...rightPaths]
        })}
      </SvgWrapper>
    )
  }

  if (gender === 'female') {
    return renderBodySvg(side === 'front' ? bodyFemaleFront : bodyFemaleBack)
  }

  return renderBodySvg(side === 'front' ? bodyFront : bodyBack)
}

export default memo(PatchedBodyHighlighter)
