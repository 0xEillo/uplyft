import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface BodyFatAddSheetProps {
  visible: boolean
  onClose: () => void
  onManual: () => void
  onBodyScan: () => void
}

export function BodyFatAddSheet({ visible, onClose, onManual, onBodyScan }: BodyFatAddSheetProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors)

  const handleManual = () => {
    haptic('light')
    onClose()
    onManual()
  }

  const handleBodyScan = () => {
    haptic('light')
    onClose()
    onBodyScan()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, backgroundColor: colors.bg }]}>
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <Text style={[styles.title, { color: colors.textPrimary }]}>Add Body Fat</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          How would you like to log your body fat?
        </Text>

        <View style={styles.options}>
          {/* Manual entry */}
          <TouchableOpacity
            style={[styles.option, { backgroundColor: colors.surfaceSubtle }]}
            onPress={handleManual}
            activeOpacity={0.75}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="pencil" size={22} color={colors.textPrimary} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Manual Entry</Text>
              <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                Type in your body fat % directly
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Body Scan */}
          <TouchableOpacity
            style={[styles.option, { backgroundColor: colors.surfaceSubtle }]}
            onPress={handleBodyScan}
            activeOpacity={0.75}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="scan" size={22} color={colors.textPrimary} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Body Scan</Text>
              <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                AI scan — body fat, BMI, and more
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

type Colors = ReturnType<typeof useThemedColors>

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingHorizontal: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      marginBottom: 20,
    },
    options: {
      gap: 10,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      padding: 16,
      gap: 14,
    },
    optionIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionText: {
      flex: 1,
      gap: 2,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    optionDesc: {
      fontSize: 13,
      lineHeight: 18,
    },
  })
