import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef } from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useThemedColors } from '@/hooks/useThemedColors'

interface FloatingMenuProps {
  visible: boolean
  onSpeechPress: () => void
  onNotesPress: () => void
}

export function FloatingMenu({
  visible,
  onSpeechPress,
  onNotesPress,
}: FloatingMenuProps) {
  const colors = useThemedColors()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current
  const styles = createStyles(colors)

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 20,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [fadeAnim, slideAnim, visible])

  if (!visible) return null

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity style={styles.menuItem} onPress={onSpeechPress}>
        <View style={styles.iconCircle}>
          <Ionicons name="mic" size={24} color={colors.brandPrimary} />
        </View>
        <Text style={styles.menuText}>Speech</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={onNotesPress}>
        <View style={styles.iconCircle}>
          <Ionicons name="create-outline" size={24} color={colors.brandPrimary} />
        </View>
        <Text style={styles.menuText}>Notes</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 100,
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 8,
      paddingHorizontal: 12,
      shadowColor: colors.shadow,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      flexDirection: 'row',
      gap: 8,
    },
    menuItem: {
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.brandPrimarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    menuText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  })
