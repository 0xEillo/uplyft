import { AppColors } from '@/constants/colors'
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
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onLeftPress}
        style={styles.headerButton}
        disabled={leftDisabled}
      >
        {leftIcon && (
          <Ionicons name={leftIcon} size={28} color={AppColors.text} />
        )}
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
              color={
                rightStyle === 'primary' ? AppColors.white : AppColors.text
              }
            />
          ) : rightIcon ? (
            <Ionicons
              name={rightIcon}
              size={28}
              color={rightStyle === 'primary' ? AppColors.white : AppColors.text}
            />
          ) : null}
        </TouchableOpacity>
      ) : (
        <View style={styles.headerButton} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  headerButton: {
    padding: 8,
    minWidth: 44,
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: AppColors.text,
  },
})
