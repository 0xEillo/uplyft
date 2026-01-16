import { getLevelColor } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface StrengthInfoSheetProps {
  isVisible: boolean
  onClose: () => void
}

export function StrengthInfoSheet({
  isVisible,
  onClose,
}: StrengthInfoSheetProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors, insets)

  const STRENGTH_LEVELS = [
    { 
      level: 'Beginner', 
      description: 'Your focus is learning proper form and building a baseline foundation for future progress.' 
    },
    { 
      level: 'Novice', 
      description: 'The early phase of steady gains where you have graduated from the basics.' 
    },
    { 
      level: 'Intermediate', 
      description: 'A solid level of strength that requires structured programming and consistency to advance.' 
    },
    { 
      level: 'Advanced', 
      description: 'Your strength is well above average. Progress becomes more specialized and technical.' 
    },
    { 
      level: 'Elite', 
      description: 'Performance comparable to regional competitive athletes in strength sports.' 
    },
    { 
      level: 'World Class', 
      description: 'The pinnacle of human capability. Matching the performance of international competitors.' 
    },
  ] as const

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Strength Levels</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.mainDescription}>
              Your level reflects your relative strength—how much you can lift compared to your gender and bodyweight.
            </Text>

            <View style={styles.levelsContainer}>
              {STRENGTH_LEVELS.map((item) => (
                <View key={item.level} style={styles.levelCard}>
                  <View style={styles.levelHeader}>
                    <View 
                      style={[
                        styles.colorIndicator, 
                        { backgroundColor: getLevelColor(item.level as any) }
                      ]} 
                    />
                    <Text style={styles.levelTitle}>{item.level}</Text>
                  </View>
                  <Text style={styles.levelDescription}>{item.description}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheetContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
      paddingBottom: insets.bottom + 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 24,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      paddingHorizontal: 24,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    mainDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: 32,
      letterSpacing: -0.2,
    },
    levelsContainer: {
      gap: 16,
    },
    levelCard: {
      backgroundColor: colors.feedCardBackground,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    levelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    colorIndicator: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    levelTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.4,
    },
    levelDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    footerNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 40,
      paddingHorizontal: 20,
    },
    footerText: {
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
      fontWeight: '500',
      lineHeight: 20,
    },
  })
