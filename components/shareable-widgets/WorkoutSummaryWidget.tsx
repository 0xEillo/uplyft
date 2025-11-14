import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WorkoutSessionWithDetails } from '@/types/database.types';
import { useThemedColors } from '@/hooks/useThemedColors';

const formatStopwatch = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

interface WorkoutSummaryWidgetProps {
  workout: WorkoutSessionWithDetails;
  weightUnit: 'kg' | 'lb';
  workoutTitle?: string;
}

export const WorkoutSummaryWidget = React.forwardRef<View, WorkoutSummaryWidgetProps>(
  ({ workout, weightUnit, workoutTitle }, ref) => {
    const colors = useThemedColors();
    const durationDisplay = formatStopwatch(workout.duration ?? 0);

    return (
      <View ref={ref} style={styles.container} collapsable={false}>
        <LinearGradient
          colors={['#FFFFFF', '#FAFAFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Top Section: Date & Title */}
          <View style={styles.topSection}>
            <Text style={styles.date}>
              {new Date(workout.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </Text>
            {workoutTitle ? (
              <Text style={styles.title}>{workoutTitle}</Text>
            ) : (
              <Text style={styles.title}>Workout Summary</Text>
            )}
            <Text style={styles.durationText}>{durationDisplay}</Text>
          </View>

          {/* Middle Section: Detailed Workout Content */}
          <View style={styles.middleSection}>
            {/* Exercise list with set counts */}
            <View style={styles.exerciseSection}>
              {workout.workout_exercises?.slice(0, 8).map((exercise, index) => {
                const sets = exercise.sets || [];
                const exerciseName = exercise.exercise?.name || 'Exercise';
                const setCount = sets.length;

                return (
                  <View key={index} style={styles.exerciseRow}>
                    <View style={styles.exerciseIndicator}>
                      <View style={styles.exerciseDot} />
                    </View>
                    <Text style={styles.exerciseName} numberOfLines={1}>
                      {exerciseName}
                    </Text>
                    <Text style={styles.setCount}>
                      {setCount > 0 ? `${setCount} set${setCount > 1 ? 's' : ''}` : 'No sets'}
                    </Text>
                  </View>
                );
              })}
              {workout.workout_exercises && workout.workout_exercises.length > 8 && (
                <Text style={styles.moreExercises}>
                  +{workout.workout_exercises.length - 8} more exercises
                </Text>
              )}
            </View>
          </View>

          {/* Bottom Section: Branding */}
          <View style={styles.bottomSection}>
            <View style={styles.brandContainer}>
              <View style={styles.brandLine} />
              <Text style={styles.brandText}>REP AI</Text>
              <View style={styles.brandLine} />
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }
);

WorkoutSummaryWidget.displayName = 'WorkoutSummaryWidget';

const styles = StyleSheet.create({
  container: {
    width: 360,
    height: 420,
    borderRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  gradient: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  topSection: {
    gap: 6,
    marginBottom: 4,
  },
  date: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.8,
    lineHeight: 28,
  },
  durationText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  middleSection: {
    flex: 1,
    marginVertical: 16,
  },
  exerciseSection: {
    flex: 1,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  exerciseIndicator: {
    width: 20,
    alignItems: 'center',
  },
  exerciseDot: {
    width: 6,
    height: 6,
    borderRadius: 0,
    backgroundColor: '#FF6B35',
  },
  exerciseName: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  setCount: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  moreExercises: {
    fontSize: 11,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  bottomSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E0E0E0',
  },
  brandText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: 4,
  },
});

