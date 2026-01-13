import React from 'react'
import { Circle, Path, Rect, Svg } from 'react-native-svg'

export type WizardIconName =
  | 'goal'
  | 'muscles'
  | 'duration'
  | 'equipment'
  | 'notes'

export interface WizardIconProps {
  name: WizardIconName
  size?: number
  color?: string
}

export function WizardIcon({
  name,
  size = 24,
  color = '#FF5722',
}: WizardIconProps): React.JSX.Element | null {
  const strokeWidth = 2.5

  switch (name) {
    case 'equipment':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 8H4C2.89543 8 2 8.89543 2 10V14C2 15.1046 2.89543 16 4 16H6M18 8H20C21.1046 8 22 8.89543 22 10V14C22 15.1046 21.1046 16 20 16H18M6 12H18M7 7H10V17H7V7ZM14 7H17V17H14V7Z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )
    case 'goal':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle
            cx="12"
            cy="12"
            r="9"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Circle
            cx="12"
            cy="12"
            r="5"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Circle cx="12" cy="12" r="1.5" fill={color} />
        </Svg>
      )
    case 'muscles':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle
            cx="12"
            cy="4"
            r="2.5"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Path
            d="M17 8H7C5 8 4 9 4 11C4 13 5.5 13 5.5 13L7 11.5V22H11V17H13V22H17V11.5L18.5 13C18.5 13 20 13 20 11C20 9 19 8 17 8Z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M9.5 11.5C10.5 12.5 13.5 12.5 14.5 11.5"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.8}
          />
        </Svg>
      )
    case 'duration':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle
            cx="12"
            cy="13"
            r="8"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Path
            d="M12 9V13L15 15"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Path
            d="M10 2H14"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      )
    case 'notes':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect
            x="4"
            y="3"
            width="16"
            height="18"
            rx="3"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Path
            d="M8 8H16"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Path
            d="M8 12H16"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Path
            d="M8 16H12"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      )
    default:
      return null
  }
}
