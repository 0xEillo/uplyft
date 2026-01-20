import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { ReactNode } from 'react'
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'

interface ScreenHeaderProps {
  title?: string
  onLeftPress?: () => void
  onRightPress?: () => void
  leftIcon?: keyof typeof Ionicons.glyphMap
  rightIcon?: keyof typeof Ionicons.glyphMap
  rightLoading?: boolean
  rightDisabled?: boolean
  rightStyle?: 'default' | 'primary'
  leftDisabled?: boolean
  centerComponent?: ReactNode
}

export function ScreenHeader({
  title,
  onLeftPress,
  onRightPress,
  leftIcon = 'close',
  rightIcon,
  rightLoading = false,
  rightDisabled = false,
  rightStyle = 'default',
  leftDisabled = false,
  centerComponent,
}: ScreenHeaderProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onLeftPress}
        style={styles.headerButton}
        disabled={leftDisabled}
      >
        {leftIcon && <Ionicons name={leftIcon} size={24} color={colors.textPrimary} />}
      </TouchableOpacity>

      {centerComponent ? (
        centerComponent
      ) : title ? (
        <Text style={styles.headerTitle}>{title}</Text>
      ) : (
        <View style={styles.headerButton} />
      )}

      {onRightPress ? (
        <TouchableOpacity
          onPress={onRightPress}
          style={[
            styles.headerButton,
            rightStyle === 'primary' && styles.primaryButton,
          ]}
          disabled={rightDisabled || rightLoading}
        >
          {rightLoading ? (
            <ActivityIndicator
              color={rightStyle === 'primary' ? colors.surface : colors.textPrimary}
            />
          ) : rightIcon ? (
            <Ionicons
              name={rightIcon}
              size={24}
              color={rightStyle === 'primary' ? colors.surface : colors.textPrimary}
            />
          ) : null}
        </TouchableOpacity>
      ) : (
        <View style={styles.headerButton} />
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    headerButton: {
      padding: 8,
      minWidth: 44,
    },
    primaryButton: {
      backgroundColor: colors.brandPrimary,
      borderRadius: 20,
      paddingHorizontal: 16,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  })
