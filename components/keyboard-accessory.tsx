import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import {
  InputAccessoryView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

interface KeyboardAccessoryProps {
  nativeID: string
  onConvertPress: () => void
  showConvertButton: boolean
}

export function KeyboardAccessory({
  nativeID,
  onConvertPress,
  showConvertButton,
}: KeyboardAccessoryProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const AccessoryContent = () => (
    <View style={styles.container}>
      {showConvertButton ? (
        <TouchableOpacity
          style={styles.convertButton}
          onPress={onConvertPress}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle" size={20} color={colors.primary} />
          <Text style={styles.convertButtonText}>Add exercise</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  )

  // iOS uses InputAccessoryView
  if (Platform.OS === 'ios') {
    return (
      <InputAccessoryView nativeID={nativeID}>
        <AccessoryContent />
      </InputAccessoryView>
    )
  }

  // Android: render inline (will be positioned via parent)
  return <AccessoryContent />
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    convertButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    convertButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    placeholder: {
      height: 36,
    },
  })
