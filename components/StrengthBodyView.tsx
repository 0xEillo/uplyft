import { BodyHighlighterDual } from "@/components/BodyHighlighterDual";
import { ExerciseMediaThumbnail } from "@/components/ExerciseMedia";
import { LevelBadge } from "@/components/LevelBadge";
import { LifterLevelsSheet } from "@/components/LifterLevelsSheet";
import { useTheme } from "@/contexts/theme-context";
import {
    getLevelColor,
    getLevelIntensity,
    useStrengthData,
    type ExerciseData,
    type MuscleGroupData,
} from "@/hooks/useStrengthData";
import { useThemedColors } from "@/hooks/useThemedColors";
import {
    BODY_PART_DISPLAY_NAMES,
    BODY_PART_TO_DATABASE_MUSCLE,
    type BodyPartSlug,
} from "@/lib/body-mapping";
import {
    EXERCISE_MUSCLE_MAPPING,
    getExerciseNameMap,
    TIER2_WEIGHT,
} from "@/lib/exercise-standards-config";
import {
    calculateExerciseStrengthPoints,
    LEVEL_POINT_ANCHORS,
} from "@/lib/overall-strength-score";
import {
    getProgressDeltaPoints,
    getStrengthGender,
} from "@/lib/strength-progress";
import {
    getStandardsLadder,
    type StrengthLevel,
    type StrengthStandard,
} from "@/lib/strength-standards";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import Body from "react-native-body-highlighter";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STRENGTH_MUSCLE_TAP_DISCOVERED_KEY = "@strength_muscle_tap_discovered";
const PROGRESS_DELTA_VISIBILITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const EXERCISE_CONFIG_BY_NAME = getExerciseNameMap();

type DisplayGroup = "Legs" | "Back" | "Chest" | "Shoulders" | "Arms" | "Core";

const DISPLAY_GROUP_BODY_MAPPING: Record<
  DisplayGroup,
  { slug: BodyPartSlug; side: "front" | "back"; offsetY: number; scale: number }
> = {
  Legs: { slug: "quadriceps", side: "front", offsetY: -18, scale: 0.25 },
  Back: { slug: "upper-back", side: "back", offsetY: 29, scale: 0.37 },
  Chest: { slug: "chest", side: "front", offsetY: 29, scale: 0.37 },
  Shoulders: { slug: "deltoids", side: "front", offsetY: 29, scale: 0.37 },
  Arms: { slug: "biceps", side: "front", offsetY: 29, scale: 0.37 },
  Core: { slug: "abs", side: "front", offsetY: 29, scale: 0.37 },
};

const DISPLAY_GROUP_ORDER: DisplayGroup[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
];

function mapMuscleToDisplayGroup(muscle: string | null): DisplayGroup | null {
  if (!muscle) return null;
  switch (muscle) {
    case "Quads":
    case "Hamstrings":
    case "Glutes":
    case "Calves":
    case "Adductors":
      return "Legs";
    case "Back":
    case "Lats":
    case "Traps":
    case "Lower Back":
      return "Back";
    case "Chest":
      return "Chest";
    case "Shoulders":
      return "Shoulders";
    case "Biceps":
    case "Triceps":
    case "Forearms":
      return "Arms";
    case "Abs":
    case "Core":
      return "Core";
    default:
      return null;
  }
}

const MUSCLE_HIGHLIGHT_COLORS = ["#EF4444"];
const MUSCLE_BORDER_COLOR = "#D1D5DB";

type FocusGroup = "Legs" | "Back" | "Chest" | "Shoulders" | "Arms";

const FOCUS_GROUP_WEIGHTS: Record<FocusGroup, number> = {
  Legs: 0.25,
  Back: 0.25,
  Chest: 0.2,
  Shoulders: 0.2,
  Arms: 0.1,
};

interface TrackedExerciseWithProgress extends ExerciseData {
  level: StrengthLevel;
  progress: number;
  nextLevel: StrengthLevel | null;
  targetWeight: number | null;
  progressDelta: number;
  showRecentProgressDelta: boolean;
}

interface PriorityExerciseRecommendation extends TrackedExerciseWithProgress {
  rank: number;
  focusGroup: FocusGroup | null;
  focusLabel: string;
  focusWeakness: number;
  targetDeltaKg: number;
  estimatedScoreGain: number;
  impactScore: number;
}

type SectionInfoKey = "lifter-level" | "level-up" | "your-exercises";

function mapMuscleToFocusGroup(
  muscleGroup: string | null | undefined,
): FocusGroup | null {
  if (!muscleGroup) return null;

  switch (muscleGroup) {
    case "Quads":
    case "Hamstrings":
    case "Glutes":
    case "Calves":
    case "Adductors":
      return "Legs";
    case "Back":
    case "Traps":
    case "Lower Back":
      return "Back";
    case "Chest":
      return "Chest";
    case "Shoulders":
      return "Shoulders";
    case "Biceps":
    case "Triceps":
    case "Forearms":
      return "Arms";
    default:
      return null;
  }
}

export function StrengthBodyView({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const colors = useThemedColors();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const router = useRouter();
  const { isDark } = useTheme();
  const {
    profile,
    isLoading,
    refreshing,
    onRefresh,
    overallLevel,
    muscleGroups,
    exerciseData,
    getStrengthInfo,
    best1RMSnapshotByExerciseId,
  } = useStrengthData();

  const [showLevelsSheet, setShowLevelsSheet] = useState(false);
  const [hasDiscoveredMuscleTap, setHasDiscoveredMuscleTap] = useState(false);
  const [expandedMuscleGroups, setExpandedMuscleGroups] = useState<Set<string>>(
    new Set(),
  );
  const strengthGender = getStrengthGender(profile?.gender);

  useEffect(() => {
    AsyncStorage.getItem(STRENGTH_MUSCLE_TAP_DISCOVERED_KEY).then((v) => {
      if (v === "true") setHasDiscoveredMuscleTap(true);
    });
  }, []);
  const recommendationCardWidth = useMemo(
    () => Math.max(264, Math.min(348, viewportWidth - 68)),
    [viewportWidth],
  );

  // Compute tracked exercises with their level-up progression info
  const trackedExercisesWithProgress = useMemo<
    TrackedExerciseWithProgress[]
  >(() => {
    if (!strengthGender || !profile?.weight_kg || exerciseData.length === 0) {
      return [];
    }

    const now = Date.now();

    const tracked = exerciseData
      .map<TrackedExerciseWithProgress | null>((exercise) => {
        const strengthInfo = getStrengthInfo(
          exercise.exerciseName,
          exercise.max1RM,
        );
        if (!strengthInfo) {
          return null;
        }

        const ladder = getStandardsLadder(
          exercise.exerciseName,
          strengthGender,
        );

        let targetWeight: number | null = null;
        if (ladder && strengthInfo.nextLevel) {
          const nextLevelName = strengthInfo.nextLevel.level;
          const nextLevelStandard = ladder.find(
            (s: StrengthStandard) => s.level === nextLevelName,
          );
          if (nextLevelStandard && profile.weight_kg) {
            targetWeight = Math.ceil(
              profile.weight_kg * nextLevelStandard.multiplier,
            );
          }
        }

        const snapshot = best1RMSnapshotByExerciseId[exercise.exerciseId];
        const previousBest1RM = snapshot?.previousBest1RM ?? 0;
        const previousStrengthInfo =
          previousBest1RM > 0
            ? getStrengthInfo(exercise.exerciseName, previousBest1RM)
            : null;
        const progressDelta = getProgressDeltaPoints(
          previousStrengthInfo
            ? {
                level: previousStrengthInfo.level,
                progress: previousStrengthInfo.progress,
              }
            : null,
          {
            level: strengthInfo.level,
            progress: strengthInfo.progress,
          },
        );
        const lastIncreaseAt = snapshot?.lastIncreaseAt;
        const lastIncreaseTime = lastIncreaseAt
          ? new Date(lastIncreaseAt).getTime()
          : NaN;
        const showRecentProgressDelta =
          progressDelta > 0 &&
          Number.isFinite(lastIncreaseTime) &&
          now - lastIncreaseTime <= PROGRESS_DELTA_VISIBILITY_WINDOW_MS;

        return {
          ...exercise,
          level: strengthInfo.level,
          progress: strengthInfo.progress,
          nextLevel: strengthInfo.nextLevel?.level || null,
          targetWeight,
          progressDelta,
          showRecentProgressDelta,
        };
      })
      .filter(
        (exercise): exercise is TrackedExerciseWithProgress =>
          exercise !== null,
      );

    return tracked.sort((a, b) => {
      const intensityA = getLevelIntensity(a.level);
      const intensityB = getLevelIntensity(b.level);
      if (intensityA !== intensityB) {
        return intensityB - intensityA;
      }
      return b.progress - a.progress;
    });
  }, [
    best1RMSnapshotByExerciseId,
    exerciseData,
    getStrengthInfo,
    profile?.weight_kg,
    strengthGender,
  ]);

  const exercisesByGroup = useMemo<
    [DisplayGroup, TrackedExerciseWithProgress[]][]
  >(() => {
    const grouped = new Map<DisplayGroup, TrackedExerciseWithProgress[]>();
    DISPLAY_GROUP_ORDER.forEach((g) => grouped.set(g, []));

    trackedExercisesWithProgress.forEach((exercise) => {
      const config = EXERCISE_CONFIG_BY_NAME.get(exercise.exerciseName);
      const canonicalName = config?.name ?? exercise.exerciseName;
      const muscle =
        EXERCISE_MUSCLE_MAPPING[canonicalName] ?? exercise.muscleGroup ?? null;
      const group = mapMuscleToDisplayGroup(muscle);
      if (group && grouped.has(group)) {
        grouped.get(group)!.push(exercise);
      }
    });

    return DISPLAY_GROUP_ORDER.map(
      (g) =>
        [g, grouped.get(g) ?? []] as [
          DisplayGroup,
          TrackedExerciseWithProgress[],
        ],
    );
  }, [trackedExercisesWithProgress]);

  const priorityRecommendations = useMemo<
    PriorityExerciseRecommendation[]
  >(() => {
    const bodyweightKg = profile?.weight_kg;
    if (
      !strengthGender ||
      typeof bodyweightKg !== "number" ||
      bodyweightKg <= 0 ||
      trackedExercisesWithProgress.length === 0
    ) {
      return [];
    }

    type GroupStrengthState = {
      topExerciseId: string | null;
      topScore: number;
      runnerUpScore: number;
    };

    const groupState = new Map<FocusGroup, GroupStrengthState>(
      (Object.keys(FOCUS_GROUP_WEIGHTS) as FocusGroup[]).map((group) => [
        group,
        { topExerciseId: null, topScore: 0, runnerUpScore: 0 },
      ]),
    );

    const baseRows = trackedExercisesWithProgress.map((exercise) => {
      const config = EXERCISE_CONFIG_BY_NAME.get(exercise.exerciseName);
      const canonicalName = config?.name ?? exercise.exerciseName;
      const tier = config?.tier === 1 ? 1 : 2;
      const tierWeight = tier === 1 ? 1 : TIER2_WEIGHT;

      const specificMuscle =
        EXERCISE_MUSCLE_MAPPING[canonicalName] ?? exercise.muscleGroup ?? null;
      const focusGroup = mapMuscleToFocusGroup(specificMuscle);

      const currentPoints =
        calculateExerciseStrengthPoints({
          exerciseName: exercise.exerciseName,
          gender: strengthGender,
          bodyweightKg,
          estimated1RMKg: exercise.max1RM,
        }) ?? 0;
      const weightedCurrentPoints = currentPoints * tierWeight;

      if (focusGroup) {
        const state = groupState.get(focusGroup);
        if (state) {
          if (weightedCurrentPoints > state.topScore) {
            state.runnerUpScore = state.topScore;
            state.topScore = weightedCurrentPoints;
            state.topExerciseId = exercise.exerciseId;
          } else if (weightedCurrentPoints > state.runnerUpScore) {
            state.runnerUpScore = weightedCurrentPoints;
          }
        }
      }

      return {
        exercise,
        tier,
        specificMuscle,
        focusGroup,
        weightedCurrentPoints,
      };
    });

    const bestGroupScore = Math.max(
      0,
      ...Array.from(groupState.values()).map((group) => group.topScore),
    );

    const weaknessByGroup = new Map<FocusGroup, number>();
    (Object.keys(FOCUS_GROUP_WEIGHTS) as FocusGroup[]).forEach((group) => {
      const topScore = groupState.get(group)?.topScore ?? 0;
      const weakness =
        bestGroupScore > 0
          ? Math.max(0, (bestGroupScore - topScore) / bestGroupScore)
          : 0;
      weaknessByGroup.set(group, weakness);
    });

    const groupOrder = (Object.keys(FOCUS_GROUP_WEIGHTS) as FocusGroup[]).sort(
      (a, b) => {
        const weaknessGap =
          (weaknessByGroup.get(b) ?? 0) - (weaknessByGroup.get(a) ?? 0);
        if (Math.abs(weaknessGap) > 0.025) {
          return weaknessGap;
        }
        return FOCUS_GROUP_WEIGHTS[b] - FOCUS_GROUP_WEIGHTS[a];
      },
    );
    const groupRank = new Map<FocusGroup, number>(
      groupOrder.map((group, index) => [group, index]),
    );

    const now = Date.now();

    const trackedExerciseNames = new Set(
      trackedExercisesWithProgress.map((e) => e.exerciseName),
    );

    const untappedBaseRows = Array.from(EXERCISE_CONFIG_BY_NAME.values())
      .filter((config) => !trackedExerciseNames.has(config.name))
      .map((config) => {
        const canonicalName = config.name;
        const specificMuscle = EXERCISE_MUSCLE_MAPPING[canonicalName] ?? null;
        const focusGroup = mapMuscleToFocusGroup(specificMuscle);

        let projectedLevel: StrengthLevel =
          overallLevel?.balancedLevel ?? "Novice";
        if (projectedLevel === "Untrained") projectedLevel = "Novice";

        let maxGroupIntensity = getLevelIntensity("Untrained");
        trackedExercisesWithProgress.forEach((e) => {
          const fallback =
            EXERCISE_MUSCLE_MAPPING[e.exerciseName] ?? e.muscleGroup ?? null;
          const g = mapMuscleToFocusGroup(fallback);
          if (g === focusGroup) {
            const intensity = getLevelIntensity(e.level);
            if (intensity > maxGroupIntensity) {
              maxGroupIntensity = intensity;
              projectedLevel = e.level;
            }
          }
        });

        const ladder = getStandardsLadder(canonicalName, strengthGender);
        if (!ladder) return null;

        let reliableTarget = ladder.find((s) => s.level === projectedLevel);
        if (!reliableTarget)
          reliableTarget = ladder.find((s) => s.level === "Novice");
        if (!reliableTarget) return null;

        const targetWeight = Math.ceil(
          bodyweightKg * reliableTarget.multiplier,
        );
        const tier = config.tier === 1 ? 1 : 2;

        const forgedExercise: TrackedExerciseWithProgress = {
          exerciseId: config.id,
          exerciseName: canonicalName,
          muscleGroup: specificMuscle,
          max1RM: 0,
          records: [],
          level: "Untrained",
          progress: 0,
          nextLevel: reliableTarget.level,
          targetWeight,
          progressDelta: 0,
          showRecentProgressDelta: false,
          gifUrl: config.gifUrl,
        };

        return {
          exercise: forgedExercise,
          tier,
          specificMuscle,
          focusGroup,
          weightedCurrentPoints: 0,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const trackedExerciseIds = new Set(baseRows.map((r) => r.exercise.exerciseId))
    const allBaseRows = [
      ...baseRows,
      ...untappedBaseRows.filter((r) => !trackedExerciseIds.has(r.exercise.exerciseId)),
    ]

    const prioritized = allBaseRows
      .filter(
        (row) => row.exercise.nextLevel && row.exercise.targetWeight !== null,
      )
      .map((row) => {
        const targetWeight = row.exercise.targetWeight ?? row.exercise.max1RM;
        const tierWeight = row.tier === 1 ? 1 : TIER2_WEIGHT;
        const groupWeight = row.focusGroup
          ? FOCUS_GROUP_WEIGHTS[row.focusGroup]
          : 0.08;

        const nextPoints =
          calculateExerciseStrengthPoints({
            exerciseName: row.exercise.exerciseName,
            gender: strengthGender,
            bodyweightKg,
            estimated1RMKg: targetWeight,
          }) ?? 0;
        const weightedNextPoints = nextPoints * tierWeight;

        const potentialDelta = Math.max(
          0,
          (weightedNextPoints - row.weightedCurrentPoints) * groupWeight,
        );

        let estimatedScoreGain = potentialDelta;
        let focusWeakness = 0;
        let orderingRank = Number.MAX_SAFE_INTEGER;

        if (row.focusGroup) {
          const state = groupState.get(row.focusGroup);
          const currentTop = state?.topScore ?? 0;
          const alternateTop =
            state?.topExerciseId === row.exercise.exerciseId
              ? state.runnerUpScore
              : (state?.topScore ?? 0);
          const predictedTop = Math.max(alternateTop, weightedNextPoints);
          const groupLift = Math.max(0, predictedTop - currentTop);
          estimatedScoreGain = Math.max(
            groupLift * groupWeight,
            potentialDelta * 0.35,
          );
          focusWeakness = weaknessByGroup.get(row.focusGroup) ?? 0;
          orderingRank =
            groupRank.get(row.focusGroup) ?? Number.MAX_SAFE_INTEGER;
        }

        const isUntapped =
          row.exercise.max1RM === 0 && row.exercise.level === "Untrained";

        const progressToLevelUp = isUntapped
          ? 0.75
          : Math.max(0, Math.min(1, row.exercise.progress / 100));

        const targetDeltaKg = Math.max(
          1,
          Math.ceil(targetWeight - row.exercise.max1RM),
        );

        const distanceFactor = isUntapped
          ? 0.8
          : 1 / (1 + Math.min(targetDeltaKg, 80) / 8);
        const readinessFactor = Math.max(
          0.08,
          Math.min(
            1,
            Math.pow(progressToLevelUp, 1.4) * 0.72 + distanceFactor * 0.28,
          ),
        );
        const tierFactor = row.tier === 1 ? 1 : 0.72;

        const lastTrainedTime = row.exercise.lastTrainedAt
          ? new Date(row.exercise.lastTrainedAt).getTime()
          : NaN;
        const daysSinceTrained = Number.isFinite(lastTrainedTime)
          ? Math.max(0, (now - lastTrainedTime) / (1000 * 60 * 60 * 24))
          : 0;
        const stalenessFactor = Math.min(1, daysSinceTrained / 21);
        const momentumFactor = row.exercise.showRecentProgressDelta
          ? Math.min(1, row.exercise.progressDelta / 20)
          : 0;

        const readinessWeightedGain =
          estimatedScoreGain * (0.15 + readinessFactor * readinessFactor * 3);

        const nextLevelIntensity = getLevelIntensity(
          row.exercise.nextLevel ?? row.exercise.level,
        );
        const levelDifficultyFactor = Math.max(
          0.22,
          Math.pow(0.8, Math.max(0, nextLevelIntensity - 2)),
        );
        const adjustedReadinessGain =
          readinessWeightedGain * levelDifficultyFactor;

        const impactScore = Math.round(
          estimatedScoreGain * levelDifficultyFactor * 3.2 +
            groupWeight * 32 * (1 + focusWeakness * 0.5) +
            progressToLevelUp * 24 +
            distanceFactor * 16 +
            levelDifficultyFactor * 12 +
            tierFactor * 11 +
            stalenessFactor * 6 +
            momentumFactor * 8,
        );
        const priorityScore = adjustedReadinessGain + impactScore * 0.08;

        return {
          ...row.exercise,
          focusGroup: row.focusGroup,
          focusLabel: row.specificMuscle ?? row.focusGroup ?? "Full Body",
          focusWeakness,
          targetDeltaKg,
          estimatedScoreGain,
          impactScore,
          priorityScore,
          levelDifficultyFactor,
          orderingRank,
        };
      })
      .sort((a, b) => {
        const gainDiff = b.priorityScore - a.priorityScore;
        if (Math.abs(gainDiff) > 0.01) {
          return gainDiff;
        }
        if (b.impactScore !== a.impactScore) {
          return b.impactScore - a.impactScore;
        }
        const difficultyDiff =
          b.levelDifficultyFactor - a.levelDifficultyFactor;
        if (Math.abs(difficultyDiff) > 0.01) {
          return difficultyDiff;
        }
        if (a.orderingRank !== b.orderingRank) {
          return a.orderingRank - b.orderingRank;
        }
        if (a.targetDeltaKg !== b.targetDeltaKg) {
          return a.targetDeltaKg - b.targetDeltaKg;
        }
        return b.progress - a.progress;
      })
      .slice(0, 5);

    // Deduplicate by exerciseId — guards against duplicate exerciseData entries
    const seen = new Set<string>();
    const dedupedPrioritized = prioritized.filter((ex) => {
      if (seen.has(ex.exerciseId)) return false;
      seen.add(ex.exerciseId);
      return true;
    });

    return dedupedPrioritized.map((exercise, index) => {
      const { orderingRank, priorityScore, levelDifficultyFactor, ...rest } =
        exercise;
      return {
        ...rest,
        rank: index + 1,
      };
    });
  }, [
    profile?.weight_kg,
    strengthGender,
    trackedExercisesWithProgress,
    overallLevel?.balancedLevel,
  ]);

  const shouldShowPrioritySection = useMemo(() => {
    if (!overallLevel) return false;
    if (exerciseData.length === 0) return false;
    if (trackedExercisesWithProgress.length === 0) return false;
    return priorityRecommendations.some(
      (exercise) => exercise.estimatedScoreGain > 0.5,
    );
  }, [
    exerciseData.length,
    overallLevel,
    priorityRecommendations,
    trackedExercisesWithProgress.length,
  ]);

  const showOverallProgressDelta = useMemo(() => {
    if (!overallLevel) return false;
    const now = Date.now();
    const lastIncreaseTime = overallLevel.lastIncreaseAt
      ? new Date(overallLevel.lastIncreaseAt).getTime()
      : NaN;

    return (
      overallLevel.progressDelta > 0 &&
      Number.isFinite(lastIncreaseTime) &&
      now - lastIncreaseTime <= PROGRESS_DELTA_VISIBILITY_WINDOW_MS
    );
  }, [overallLevel]);

  const priorityPointsColor = getLevelColor(
    overallLevel?.balancedLevel ?? "Untrained",
  );

  // Navigate to exercise detail
  const navigateToExercise = useCallback(
    (exerciseId: string) => {
      router.push({
        pathname: "/exercise/[exerciseId]",
        params: { exerciseId },
      });
    },
    [router],
  );

  const openSectionInfo = useCallback(
    (section: SectionInfoKey) => {
      router.push({
        pathname: "/lifter-level-info",
        params: { section },
      });
    },
    [router],
  );

  // Custom colors for the body highlighter based on strength levels
  // ARCHITECTURE NOTE:
  // The body highlighter library uses 1-based intensity to index the colors array.
  // Formula: Color Index = Intensity - 1
  // Index 0: Intensity 1 -> Unranked (Base Color)
  const bodyColors = useMemo(() => {
    // Unranked/Base color:
    // Dark Mode: #2A2A2A (Dark Gray)
    // Light Mode: #4A4A4A (Dark Gray - requested by user to be darker)
    const baseColor = isDark ? "#2A2A2A" : "#4A4A4A";

    return [
      baseColor, // Index 0 - Unranked (Intensity 1)
      "#9CA3AF", // Index 1 - Beginner (Intensity 2)
      "#3B82F6", // Index 2 - Novice (Intensity 3)
      "#10B981", // Index 3 - Intermediate (Intensity 4)
      "#8B5CF6", // Index 4 - Advanced (Intensity 5)
      "#F59E0B", // Index 5 - Elite (Intensity 6)
      "#EF4444", // Index 6 - World Class (Intensity 7)
    ];
  }, [isDark]);

  // Generate body data for highlighting
  const bodyData = useMemo(() => {
    const data: {
      slug: BodyPartSlug;
      intensity: number;
      side?: "left" | "right";
    }[] = [];

    // Map database muscle names to their data for easy lookup
    const muscleMap = new Map<string, MuscleGroupData>();
    muscleGroups.forEach((mg) => muscleMap.set(mg.name, mg));

    // Iterate over all supported body part slugs
    Object.entries(BODY_PART_TO_DATABASE_MUSCLE).forEach(
      ([slug, dbMuscleName]) => {
        let mgData = muscleMap.get(dbMuscleName);

        // With secondary muscle mapping in place (e.g. Squat -> Glutes), we no longer
        // need complex fallbacks here. We trust the data in muscleGroups.

        if (mgData) {
          data.push({
            slug: slug as BodyPartSlug,
            intensity: getLevelIntensity(mgData.level),
          });
        }
      },
    );

    return data;
  }, [muscleGroups]);

  // Handle body part press - navigate to native formSheet
  const handleBodyPartPress = useCallback(
    (bodyPart: { slug?: string }, _side?: "left" | "right") => {
      if (!bodyPart.slug) return;

      setHasDiscoveredMuscleTap(true);
      AsyncStorage.setItem(STRENGTH_MUSCLE_TAP_DISCOVERED_KEY, "true").catch(
        () => {},
      );

      const slug = bodyPart.slug as BodyPartSlug;
      const dbMuscleName = BODY_PART_TO_DATABASE_MUSCLE[slug];

      if (!dbMuscleName) {
        return;
      }

      const mgData = muscleGroups.find((mg) => mg.name === dbMuscleName);
      const displayName = BODY_PART_DISPLAY_NAMES[slug] || slug;

      // Build group data (with fallback for empty state)
      const groupData: MuscleGroupData = mgData || {
        name: dbMuscleName,
        level: "Beginner",
        progress: 0,
        averageScore: 0,
        exercises: [],
      };

      // Navigate to native formSheet with params
      router.push({
        pathname: "/muscle-group-detail",
        params: {
          groupDisplayName: displayName,
          bodyPartSlug: slug,
          groupDataJson: JSON.stringify(groupData),
        },
      });
    },
    [muscleGroups, router],
  );

  const styles = createStyles(colors);

  // Determine gender for body display
  const bodyGender = profile?.gender === "female" ? "female" : "male";

  // When embedded, render content without ScrollView wrapper
  const content = (
    <>
      {/* Body Section */}
      <View style={styles.bodySection}>
        {/* Side-by-Side Body Highlighter */}
        <BodyHighlighterDual
          bodyData={bodyData}
          gender={bodyGender}
          colors={bodyColors}
          onBodyPartPress={handleBodyPartPress}
        />

        {!hasDiscoveredMuscleTap && (
          <Text style={styles.bodyHint}>
            Tap the muscles to reveal exercises with standards.
          </Text>
        )}

        {/* Integrated Legend Key - Directly under the chart */}
        <View style={styles.integratedLegend}>
          <View style={styles.legendGrid}>
            {(
              [
                "Beginner",
                "Novice",
                "Intermediate",
                "Advanced",
                "Elite",
                "World Class",
              ] as StrengthLevel[]
            ).map((level) => (
              <LevelBadge
                key={level}
                level={level}
                variant="pill"
                size="small"
              />
            ))}
          </View>
        </View>

        {/* Overall Level Card - Gamified Rank */}
        {/* Overall Level Card - Gamified Rank */}
        {overallLevel ? (
          <>
            <View style={styles.sectionHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={styles.sectionHeaderText}>Lifter Level</Text>
                <TouchableOpacity
                  onPress={() => openSectionInfo("lifter-level")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.levelCard,
                {
                  borderColor: `${getLevelColor(overallLevel.balancedLevel)}66`,
                },
              ]}
              activeOpacity={0.9}
              onPress={() => setShowLevelsSheet(true)}
            >
              <View style={styles.levelCardContent}>
                <View style={styles.levelCardLeft}>
                  <Text style={styles.levelCardValue}>
                    {overallLevel.balancedLevel}
                  </Text>
                  <View style={styles.levelCardMetaRow}>
                    <View style={styles.pointsDisplay}>
                      <Text
                        style={[
                          styles.pointsCurrent,
                          { color: getLevelColor(overallLevel.balancedLevel) },
                        ]}
                      >
                        {Math.round(overallLevel.score)}
                      </Text>
                      {overallLevel.balancedNextLevel ? (
                        <>
                          <Text style={styles.pointsSlash}>/</Text>
                          <Text style={styles.pointsTotal}>
                            {
                              LEVEL_POINT_ANCHORS[
                                overallLevel.balancedNextLevel
                              ]
                            }
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.pointsTotal}> pts</Text>
                      )}
                    </View>
                    {showOverallProgressDelta && (
                      <Text style={styles.scoreDeltaText}>
                        ▲ {overallLevel.progressDelta}
                      </Text>
                    )}
                  </View>
                </View>
                <LevelBadge
                  level={overallLevel.balancedLevel}
                  size="hero"
                  showTooltipOnPress={false}
                />
              </View>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={styles.sectionHeaderText}>Lifter Level</Text>
                <TouchableOpacity
                  onPress={() => openSectionInfo("lifter-level")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.levelCard,
                {
                  borderColor: `${getLevelColor("Untrained")}66`,
                },
              ]}
              activeOpacity={0.9}
              onPress={() => setShowLevelsSheet(true)}
            >
              <View style={styles.levelCardContent}>
                <View style={styles.levelCardLeft}>
                  <Text
                    style={[
                      styles.levelCardValue,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Unranked
                  </Text>
                  <View style={styles.levelCardMetaRow}>
                    <Text style={styles.pointsTotal}>
                      Tap to see lifter levels
                    </Text>
                  </View>
                </View>
                <LevelBadge level="Untrained" size="hero" />
              </View>
            </TouchableOpacity>
          </>
        )}

        {shouldShowPrioritySection && (
          <>
            <View style={styles.sectionHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={styles.sectionHeaderText}>Priority</Text>
                <TouchableOpacity
                  onPress={() => openSectionInfo("level-up")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.priorityCarouselContent}
              snapToInterval={recommendationCardWidth + 12}
              snapToAlignment="start"
              decelerationRate="fast"
              nestedScrollEnabled
            >
              {priorityRecommendations.map((exercise) => {
                const projectedGain = Math.max(
                  1,
                  Math.round(exercise.estimatedScoreGain),
                );
                const targetLevel = exercise.nextLevel ?? exercise.level;
                const isUntapped =
                  exercise.max1RM === 0 && exercise.level === "Untrained";

                return (
                  <TouchableOpacity
                    key={`priority-${exercise.exerciseId}`}
                    style={[
                      styles.priorityCard,
                      {
                        width: recommendationCardWidth,
                      },
                    ]}
                    onPress={() => navigateToExercise(exercise.exerciseId)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.priorityMainRow}>
                      <ExerciseMediaThumbnail
                        gifUrl={exercise.gifUrl}
                        style={styles.exerciseCardThumbnail}
                      />
                      <View style={styles.priorityExerciseTextWrap}>
                        <Text style={styles.exerciseCardName} numberOfLines={2}>
                          {exercise.exerciseName}
                        </Text>
                        <View style={styles.priorityActionRowInline}>
                          <Text
                            style={styles.priorityActionText}
                            numberOfLines={1}
                          >
                            {isUntapped
                              ? `Unlock ${targetLevel}`
                              : `Level up to ${targetLevel}`}
                          </Text>
                          <View style={styles.priorityPointsLine}>
                            <Text
                              style={[
                                styles.priorityPointsValue,
                                { color: priorityPointsColor },
                              ]}
                            >
                              +{projectedGain}
                            </Text>
                            <Text
                              style={[
                                styles.priorityPointsSuffix,
                                { color: priorityPointsColor },
                              ]}
                            >
                              pts
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Muscle Ranks Section */}
        <>
          <View style={styles.sectionHeader}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={styles.sectionHeaderText}>Muscle Ranks</Text>
              <TouchableOpacity
                onPress={() => openSectionInfo("your-exercises")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.exerciseCardsContainer}>
            {exercisesByGroup.map(([group, exercises]) => {
              const isExpanded = expandedMuscleGroups.has(group);
              const bodyMapping = DISPLAY_GROUP_BODY_MAPPING[group];
              const bestExercise = exercises[0];

              return (
                <View key={group}>
                  {/* Muscle Group Header */}
                  <TouchableOpacity
                    style={styles.muscleGroupHeader}
                    onPress={() => {
                      setExpandedMuscleGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group)) {
                          next.delete(group);
                        } else {
                          next.add(group);
                        }
                        return next;
                      });
                    }}
                    activeOpacity={0.75}
                  >
                    {/* Muscle Body Icon */}
                    <View style={styles.muscleIconOuter}>
                      <View style={styles.muscleIconInner} pointerEvents="none">
                        {bodyMapping ? (
                          <View
                            style={[
                              styles.muscleBodyWrapper,
                              {
                                transform: [
                                  { translateY: bodyMapping.offsetY },
                                ],
                              },
                            ]}
                          >
                            <Body
                              data={[{ slug: bodyMapping.slug, intensity: 1 }]}
                              gender="male"
                              side={bodyMapping.side}
                              scale={bodyMapping.scale}
                              colors={MUSCLE_HIGHLIGHT_COLORS}
                              border={MUSCLE_BORDER_COLOR}
                            />
                          </View>
                        ) : (
                          <Ionicons
                            name="body-outline"
                            size={22}
                            color={colors.textSecondary}
                          />
                        )}
                      </View>
                    </View>

                    {/* Muscle Name + Count */}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.muscleGroupName}>{group}</Text>
                      <Text style={styles.muscleGroupSubtext}>
                        {exercises.length}{" "}
                        {exercises.length === 1 ? "exercise" : "exercises"}
                      </Text>
                    </View>

                    {/* Best level badge */}
                    <LevelBadge
                      level={
                        exercises.length > 0
                          ? (bestExercise!.level as StrengthLevel)
                          : "Untrained"
                      }
                      variant="pill"
                      size="small"
                    />

                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>

                  {/* Expanded Exercise List */}
                  {isExpanded && (
                    <View style={styles.muscleGroupExercises}>
                      {exercises.length === 0 ? (
                        <TouchableOpacity
                          style={[styles.exerciseCard, styles.unrankedCta]}
                          onPress={() => router.push("/(tabs)/create-post")}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={24}
                            color={colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.unrankedCtaText,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Log sets to rank this muscle
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        exercises.map((exercise) => {
                          const levelColor = getLevelColor(exercise.level!);
                          const gainColor = getLevelColor("Intermediate");
                          return (
                            <TouchableOpacity
                              key={exercise.exerciseId}
                              style={styles.exerciseCard}
                              onPress={() =>
                                navigateToExercise(exercise.exerciseId)
                              }
                              activeOpacity={0.7}
                            >
                              <View style={styles.exerciseInlineHeader}>
                                <ExerciseMediaThumbnail
                                  gifUrl={exercise.gifUrl}
                                  style={styles.exerciseCardThumbnail}
                                />
                                <View
                                  style={styles.exerciseInlineHeaderContent}
                                >
                                  <Text
                                    style={styles.exerciseCardName}
                                    numberOfLines={1}
                                  >
                                    {exercise.exerciseName}
                                  </Text>
                                  <View
                                    style={styles.exerciseInlineProgressWrap}
                                  >
                                    <View
                                      style={
                                        styles.exerciseInlineProgressTopRow
                                      }
                                    >
                                      <View
                                        style={styles.exerciseInlineMetaRow}
                                      >
                                        <LevelBadge
                                          level={
                                            exercise.level! as StrengthLevel
                                          }
                                          variant="pill"
                                          size="xs"
                                        />
                                        {exercise.showRecentProgressDelta && (
                                          <Text
                                            style={[
                                              styles.exerciseInlineGainText,
                                              { color: gainColor },
                                            ]}
                                          >
                                            ▲ {exercise.progressDelta}%
                                          </Text>
                                        )}
                                      </View>
                                      <View
                                        style={
                                          styles.exerciseInlineProgressValueRow
                                        }
                                      >
                                        <Text
                                          style={[
                                            styles.exerciseInlineProgressPercent,
                                            { color: levelColor },
                                          ]}
                                        >
                                          {Math.round(exercise.progress)}%
                                        </Text>
                                      </View>
                                    </View>
                                    <View style={styles.exerciseInlineBarTrack}>
                                      <View
                                        style={[
                                          styles.exerciseInlineBarFill,
                                          {
                                            width: `${Math.max(0, Math.min(100, exercise.progress))}%`,
                                            backgroundColor: levelColor,
                                          },
                                        ]}
                                      />
                                    </View>
                                  </View>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </>
      </View>
    </>
  );

  const modals = (
    <>
      {/* Lifter Levels Sheet */}
      <LifterLevelsSheet
        isVisible={showLevelsSheet}
        onClose={() => setShowLevelsSheet(false)}
        currentLevel={overallLevel?.balancedLevel || "Untrained"}
        score={overallLevel?.score || 0}
      />
    </>
  );

  if (embedded) {
    return (
      <>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Text style={styles.loadingText}>Loading strength data...</Text>
          </View>
        ) : (
          content
        )}
        {modals}
      </>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.loadingText}>Loading strength data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: 100 + insets.bottom },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustContentInsets
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.brandPrimary]}
              tintColor={colors.brandPrimary}
            />
          }
        >
          {content}
        </ScrollView>
      )}
      {modals}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 32,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 12,
      fontSize: 15,
      color: colors.textSecondary,
    },

    // Level Card
    levelCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 20,
      paddingVertical: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    levelCardContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    levelCardLeft: {
      flex: 1,
      justifyContent: "center",
    },
    levelCardValue: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    levelCardMetaRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
    },
    pointsDisplay: {
      flexDirection: "row",
      alignItems: "baseline",
    },
    pointsCurrent: {
      fontSize: 24,
      fontWeight: "800",
      fontVariant: ["tabular-nums"] as any,
    },
    pointsSlash: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textSecondary,
      marginLeft: 2,
    },
    pointsTotal: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textSecondary,
      fontVariant: ["tabular-nums"] as any,
    },
    scoreDeltaText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#10B981",
      fontVariant: ["tabular-nums"] as any,
    },
    weakPointContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    weakPointText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.statusWarning,
    },

    // Body Section - consistent 14px horizontal padding
    bodySection: {
      flex: 1,
      paddingHorizontal: 14,
      marginTop: -35,
    },

    bodyHint: {
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: "center",
      marginTop: 4,
      marginBottom: 10,
    },
    // Legend
    integratedLegend: {
      marginTop: 8,
      marginBottom: 0,
      paddingHorizontal: 0,
      flexDirection: "row",
      alignItems: "center",
    },
    legendGrid: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 12,
    },
    legendItemCompact: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDotSmall: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendTextCompact: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "600",
    },

    // Section Header
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 32,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    sectionHeaderText: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.textPrimary,
      letterSpacing: -0.4,
    },
    priorityCarouselContent: {
      paddingRight: 2,
      paddingBottom: 2,
      gap: 12,
    },
    priorityCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: 14,
      gap: 12,
      minHeight: 86,
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    priorityMainRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    priorityExerciseTextWrap: {
      flex: 1,
      minWidth: 0,
      gap: 4,
      justifyContent: "center",
    },
    priorityPointsLine: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 3,
    },
    priorityActionText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      flexShrink: 1,
    },
    priorityActionRowInline: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 8,
    },
    priorityPointsValue: {
      fontSize: 16,
      lineHeight: 18,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    priorityPointsSuffix: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.1,
    },

    // Exercise Cards Section
    exerciseCardsContainer: {
      gap: 6,
    },
    exerciseCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: 16,
      gap: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    exerciseInlineHeader: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 10,
    },
    exerciseCardThumbnail: {
      width: 56,
      height: 56,
      borderRadius: 14,
      backgroundColor: colors.bg,
      overflow: "hidden",
    },
    exerciseInlineHeaderContent: {
      flex: 1,
      minHeight: 56,
      justifyContent: "space-between",
      paddingVertical: 2,
    },
    exerciseInlineProgressWrap: {
      gap: 4,
    },
    exerciseInlineProgressTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    exerciseInlineMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 1,
    },
    exerciseInlineLevelLabel: {
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
    },
    exerciseInlineGainText: {
      fontSize: 10,
      fontWeight: "700",
    },
    exerciseInlineProgressValueRow: {
      flexDirection: "row",
      alignItems: "baseline",
    },
    exerciseInlineProgressPercent: {
      fontSize: 14,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    exerciseInlineBarTrack: {
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 999,
      overflow: "hidden",
    },
    exerciseInlineBarFill: {
      height: "100%",
      borderRadius: 999,
    },
    exerciseCardName: {
      fontSize: 16,
      fontWeight: "600",
      lineHeight: 20,
      color: colors.textPrimary,
    },

    // Muscle Group Dropdown
    muscleGroupHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    muscleIconOuter: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      backgroundColor: colors.bg,
    },
    muscleIconInner: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      position: "relative",
    },
    muscleBodyWrapper: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: 84,
      height: 168,
      marginTop: -84,
      marginLeft: -42,
      alignItems: "center",
      justifyContent: "center",
    },
    muscleGroupName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    muscleGroupSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    muscleGroupLevel: {
      fontSize: 12,
      fontWeight: "700",
    },
    muscleGroupExercises: {
      gap: 6,
      paddingTop: 6,
      paddingLeft: 8,
    },
    unrankedCta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
    },
    unrankedCtaText: {
      fontSize: 14,
      fontWeight: "600",
    },
  });
