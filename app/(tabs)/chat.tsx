import { WorkoutChat } from '@/components/workout-chat'
import { useThemedColors } from '@/hooks/useThemedColors'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function ChatScreen() {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <WorkoutChat />
      </View>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
    },
  })
