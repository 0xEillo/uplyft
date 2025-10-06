import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { LineChart } from 'react-native-gifted-charts'

interface StrengthScoreChartProps {
  userId: string
}

export function StrengthScoreChart({ userId }: StrengthScoreChartProps) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  )
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [progressData, setProgressData] = useState<
    { date: string; strengthScore: number }[]
  >([])
  const [isLoading, setIsLoading] = useState(false)
  const colors = useThemedColors()

  useEffect(() => {
    loadExercises()
  }, [userId])

  useEffect(() => {
    loadProgressData()
  }, [userId, selectedExercise])

  const loadExercises = async () => {
    try {
      const data = await database.exercises.getExercisesWithData(userId)
      setExercises(data)
    } catch (error) {
      console.error('Error loading exercises:', error)
    }
  }

  const loadProgressData = async () => {
    setIsLoading(true)
    try {
      if (selectedExercise) {
        // Load individual exercise progress
        const data = await database.stats.getExerciseWeightProgress(
          userId,
          selectedExercise.id,
        )
        setProgressData(
          data.map((d) => ({ date: d.date, strengthScore: d.maxWeight })),
        )
      } else {
        // Load combined strength score
        const data = await database.stats.getStrengthScoreProgress(userId)
        setProgressData(data)
      }
    } catch (error) {
      console.error('Error loading strength score data:', error)
      setProgressData([])
    } finally {
      setIsLoading(false)
    }
  }

  const filteredExercises = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Transform data for the chart
  const chartData = progressData.map((point) => ({
    value: point.strengthScore,
    dataPointText: `${point.strengthScore}`,
  }))

  // Calculate stats
  const maxScore = progressData.length
    ? Math.max(...progressData.map((p) => p.strengthScore))
    : 0
  const latestScore =
    progressData.length > 0
      ? progressData[progressData.length - 1].strengthScore
      : 0
  const firstScore = progressData.length > 0 ? progressData[0].strengthScore : 0
  const scoreChange = latestScore - firstScore
  const percentChange =
    firstScore > 0 ? ((scoreChange / firstScore) * 100).toFixed(1) : '0'

  const styles = createStyles(colors)

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <Ionicons name="analytics" size={24} color={colors.primary} />
          <Text style={styles.title}>Strength Score</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>Tracking progressive overload</Text>

      {/* Exercise Selector */}
      <TouchableOpacity
        style={styles.exerciseSelector}
        onPress={() => setShowExercisePicker(true)}
      >
        <View style={styles.exerciseSelectorLeft}>
          <Ionicons
            name="barbell-outline"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.exerciseSelectorText}>
            {selectedExercise?.name || 'All Exercises'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Stats Cards */}
      {progressData.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Current</Text>
            <Text style={styles.statValue}>{latestScore}kg</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>All-Time Peak</Text>
            <Text style={styles.statValue}>{maxScore}kg</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Change</Text>
            <Text
              style={[
                styles.statValue,
                scoreChange >= 0 ? styles.statPositive : styles.statNegative,
              ]}
            >
              {scoreChange >= 0 ? '+' : ''}
              {scoreChange}kg
            </Text>
            <Text
              style={[
                styles.statPercentage,
                scoreChange >= 0 ? styles.statPositive : styles.statNegative,
              ]}
            >
              ({percentChange}%)
            </Text>
          </View>
        </View>
      )}

      {/* Chart */}
      <View style={styles.chartContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : chartData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="bar-chart-outline"
              size={48}
              color={colors.textPlaceholder}
            />
            <Text style={styles.emptyText}>
              Complete a workout to see your strength score
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.yAxisLabel}>(kg)</Text>
            <LineChart
              data={chartData}
              width={340}
              height={220}
              spacing={Math.max(40, 340 / chartData.length)}
              initialSpacing={20}
              endSpacing={20}
              color={colors.primary}
              thickness={3}
              startFillColor={colors.primaryLight}
              endFillColor={colors.white}
              startOpacity={0.4}
              endOpacity={0.1}
              areaChart
              hideDataPoints={false}
              dataPointsColor={colors.primary}
              dataPointsRadius={4}
              textColor1={colors.textSecondary}
              textShiftY={-8}
              textShiftX={-10}
              textFontSize={10}
              curved
              hideRules
              hideYAxisText
              yAxisColor={colors.border}
              xAxisColor={colors.border}
              xAxisLabelTextStyle={{
                color: colors.textSecondary,
                fontSize: 10,
              }}
              maxValue={Math.ceil(maxScore * 1.1)} // Add 10% padding
            />
          </>
        )}
      </View>

      {/* Exercise Picker Modal */}
      <Modal
        visible={showExercisePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExercisePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Exercise</Text>
              <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={colors.textPlaceholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView style={styles.exerciseList}>
              {/* All Exercises option */}
              <TouchableOpacity
                style={[
                  styles.exerciseItem,
                  !selectedExercise && styles.exerciseItemSelected,
                ]}
                onPress={() => {
                  setSelectedExercise(null)
                  setShowExercisePicker(false)
                  setSearchQuery('')
                }}
              >
                <Text
                  style={[
                    styles.exerciseItemText,
                    !selectedExercise && styles.exerciseItemTextSelected,
                  ]}
                >
                  All Exercises
                </Text>
                {!selectedExercise && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>

              {/* Individual exercises */}
              {filteredExercises.map((exercise) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={[
                    styles.exerciseItem,
                    selectedExercise?.id === exercise.id &&
                      styles.exerciseItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedExercise(exercise)
                    setShowExercisePicker(false)
                    setSearchQuery('')
                  }}
                >
                  <Text
                    style={[
                      styles.exerciseItemText,
                      selectedExercise?.id === exercise.id &&
                        styles.exerciseItemTextSelected,
                    ]}
                  >
                    {exercise.name}
                  </Text>
                  {selectedExercise?.id === exercise.id && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      padding: 16,
      paddingTop: 8,
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 16,
      marginLeft: 32,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.white,
      padding: 12,
      borderRadius: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    statPercentage: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    statPositive: {
      color: colors.success,
    },
    statNegative: {
      color: colors.error,
    },
    chartContainer: {
      backgroundColor: colors.white,
      padding: 16,
      borderRadius: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
      minHeight: 280,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      height: 220,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyState: {
      height: 220,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 12,
    },
    yAxisLabel: {
      position: 'absolute',
      top: 16,
      left: 2,
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    exerciseSelector: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.white,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    exerciseSelectorLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    exerciseSelectorText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: 34,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    searchInput: {
      margin: 16,
      marginBottom: 8,
      padding: 12,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
      fontSize: 16,
      color: colors.text,
    },
    exerciseList: {
      paddingHorizontal: 16,
    },
    exerciseItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
      marginBottom: 4,
    },
    exerciseItemSelected: {
      backgroundColor: colors.primaryLight,
    },
    exerciseItemText: {
      fontSize: 16,
      color: colors.text,
    },
    exerciseItemTextSelected: {
      fontWeight: '600',
      color: colors.primary,
    },
  })
