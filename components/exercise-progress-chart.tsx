import { AppColors } from '@/constants/colors'
import { database } from '@/lib/database'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useState } from 'react'
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

type TimeRange = '3M' | '6M' | 'ALL'

interface ExerciseProgressChartProps {
  userId: string
}

export function ExerciseProgressChart({ userId }: ExerciseProgressChartProps) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  )
  const [timeRange, setTimeRange] = useState<TimeRange>('3M')
  const [progressData, setProgressData] = useState<
    { date: string; maxWeight: number }[]
  >([])
  const [isLoading, setIsLoading] = useState(false)
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Load all exercises on mount
  useEffect(() => {
    loadExercises()
  }, [userId])

  // Load progress data when exercise or time range changes
  useEffect(() => {
    if (selectedExercise) {
      loadProgressData()
    }
  }, [selectedExercise, timeRange])

  const loadExercises = async () => {
    try {
      const data = await database.exercises.getExercisesWithData(userId)
      setExercises(data)
      // Auto-select first exercise if available
      if (data.length > 0 && !selectedExercise) {
        setSelectedExercise(data[0])
      }
    } catch (error) {
      console.error('Error loading exercises:', error)
    }
  }

  const loadProgressData = async () => {
    if (!selectedExercise) return

    setIsLoading(true)
    try {
      const daysBack =
        timeRange === '3M' ? 90 : timeRange === '6M' ? 180 : undefined

      const data = await database.stats.getExerciseWeightProgress(
        userId,
        selectedExercise.id,
        daysBack,
      )

      setProgressData(data)
    } catch (error) {
      console.error('Error loading progress data:', error)
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
    value: point.maxWeight,
    dataPointText: `${point.maxWeight}`,
  }))

  // Calculate stats
  const maxWeight = progressData.length
    ? Math.max(...progressData.map((p) => p.maxWeight))
    : 0
  const latestWeight =
    progressData.length > 0
      ? progressData[progressData.length - 1].maxWeight
      : 0
  const firstWeight = progressData.length > 0 ? progressData[0].maxWeight : 0
  const weightChange = latestWeight - firstWeight
  const percentChange =
    firstWeight > 0 ? ((weightChange / firstWeight) * 100).toFixed(1) : '0'

  return (
    <View style={styles.container}>
      {/* Exercise Selector */}
      <TouchableOpacity
        style={styles.exerciseSelector}
        onPress={() => setShowExercisePicker(true)}
      >
        <View style={styles.exerciseSelectorLeft}>
          <Ionicons
            name="barbell-outline"
            size={20}
            color={AppColors.primary}
          />
          <Text style={styles.exerciseSelectorText}>
            {selectedExercise?.name || 'Select Exercise'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={AppColors.textSecondary} />
      </TouchableOpacity>

      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {(['3M', '6M', 'ALL'] as TimeRange[]).map((range) => (
          <TouchableOpacity
            key={range}
            style={[
              styles.timeRangeButton,
              timeRange === range && styles.timeRangeButtonActive,
            ]}
            onPress={() => setTimeRange(range)}
          >
            <Text
              style={[
                styles.timeRangeButtonText,
                timeRange === range && styles.timeRangeButtonTextActive,
              ]}
            >
              {range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats Cards */}
      {selectedExercise && progressData.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Current</Text>
            <Text style={styles.statValue}>{latestWeight}kg</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>All-Time Max</Text>
            <Text style={styles.statValue}>{maxWeight}kg</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Change</Text>
            <Text
              style={[
                styles.statValue,
                weightChange >= 0 ? styles.statPositive : styles.statNegative,
              ]}
            >
              {weightChange >= 0 ? '+' : ''}
              {weightChange}kg
            </Text>
            <Text
              style={[
                styles.statPercentage,
                weightChange >= 0 ? styles.statPositive : styles.statNegative,
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
            <ActivityIndicator size="large" color={AppColors.primary} />
          </View>
        ) : chartData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="bar-chart-outline"
              size={48}
              color={AppColors.textPlaceholder}
            />
            <Text style={styles.emptyText}>
              {selectedExercise
                ? `No data yet for ${selectedExercise.name}`
                : 'Select an exercise to view progress'}
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
              color={AppColors.primary}
              thickness={3}
              startFillColor={AppColors.primaryLight}
              endFillColor={AppColors.white}
              startOpacity={0.4}
              endOpacity={0.1}
              areaChart
              hideDataPoints={false}
              dataPointsColor={AppColors.primary}
              dataPointsRadius={4}
              textColor1={AppColors.textSecondary}
              textShiftY={-8}
              textShiftX={-10}
              textFontSize={10}
              curved
              hideRules
              hideYAxisText
              yAxisColor={AppColors.border}
              xAxisColor={AppColors.border}
              xAxisLabelTextStyle={{
                color: AppColors.textSecondary,
                fontSize: 10,
              }}
              maxValue={Math.ceil(maxWeight * 1.1)} // Add 10% padding
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
                <Ionicons name="close" size={24} color={AppColors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={AppColors.textPlaceholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView style={styles.exerciseList}>
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
                      color={AppColors.primary}
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

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  exerciseSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: AppColors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: AppColors.shadow,
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
    color: AppColors.text,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: AppColors.backgroundLight,
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: AppColors.primary,
  },
  timeRangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  timeRangeButtonTextActive: {
    color: AppColors.white,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: AppColors.white,
    padding: 12,
    borderRadius: 8,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statLabel: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
  },
  statPercentage: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statPositive: {
    color: AppColors.success,
  },
  statNegative: {
    color: AppColors.error,
  },
  chartContainer: {
    backgroundColor: AppColors.white,
    padding: 16,
    borderRadius: 12,
    shadowColor: AppColors.shadow,
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
    color: AppColors.textTertiary,
    textAlign: 'center',
    marginTop: 12,
  },
  yAxisLabel: {
    position: 'absolute',
    top: 16,
    left: 2,
    fontSize: 11,
    color: AppColors.textSecondary,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: AppColors.white,
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
    borderBottomColor: AppColors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
  },
  searchInput: {
    margin: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: AppColors.backgroundLight,
    borderRadius: 8,
    fontSize: 16,
    color: AppColors.text,
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
    backgroundColor: AppColors.primaryLight,
  },
  exerciseItemText: {
    fontSize: 16,
    color: AppColors.text,
  },
  exerciseItemTextSelected: {
    fontWeight: '600',
    color: AppColors.primary,
  },
})
