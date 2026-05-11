import { BodyHighlighterDual } from "@/components/BodyHighlighterDual";
import { LevelBadge } from "@/components/LevelBadge";
import { useBodyDiagramGender } from "@/hooks/useBodyDiagramGender";
import { useTheme } from "@/contexts/theme-context";
import { useThemedColors } from "@/hooks/useThemedColors";
import type { StrengthLevel } from "@/lib/strength-standards";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const LEVEL_PILLS: StrengthLevel[] = [
  "Beginner",
  "Novice",
  "Intermediate",
  "Advanced",
  "Elite",
  "World Class",
];

/**
 * Non-Pro placeholder for the Progress tab. Mirrors the *shape* of the Pro
 * hero card (level name, score row, body silhouette, full level legend) so
 * users see exactly what they're about to unlock — without leaking real
 * scoring or muscle data. Single CTA pushes the pre-paywall feature tour.
 */
export function StrengthBodyLocked() {
  const colors = useThemedColors();
  const { isDark } = useTheme();
  const router = useRouter();
  const bodyGender = useBodyDiagramGender();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const baseColor = isDark ? "#2A2A2A" : "#4A4A4A";
  const bodyColors = useMemo(() => [baseColor], [baseColor]);
  const lockedTint = colors.textTertiary;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Lifter Level</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroPadded}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroLeft}>
              <Text style={[styles.heroLevelName, { color: lockedTint }]}>
                Untrained
              </Text>
              <View style={styles.heroScoreRow}>
                <Text style={[styles.heroScorePlaceholder, { color: lockedTint }]}>
                  •••
                </Text>
                <Text style={styles.heroScoreSuffix}>/ 100 pts</Text>
              </View>
              <View
                style={[
                  styles.heroProgressTrack,
                  { backgroundColor: colors.border },
                ]}
              />
            </View>
            <View style={styles.heroBadgeWrap}>
              <LevelBadge
                level="Untrained"
                size="hero"
                showTooltipOnPress={false}
              />
            </View>
          </View>
        </View>

        <View style={styles.bodyWrap} pointerEvents="none">
          <BodyHighlighterDual
            bodyData={[]}
            gender={bodyGender}
            colors={bodyColors}
            onBodyPartPress={() => undefined}
          />
        </View>

        <View style={styles.heroPadded}>
          <View style={styles.heroLegend}>
            {LEVEL_PILLS.map((level) => (
              <LevelBadge
                key={level}
                level={level}
                variant="pill"
                size="small"
              />
            ))}
          </View>
          <Text style={styles.lockedTagline}>
            Unlock your strength score, lifter level, priority lifts, and
            muscle ranks across every group.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push("/strength-pro-tour")}
        style={[styles.unlockButton, { backgroundColor: colors.brandPrimary }]}
      >
        <Ionicons name="star" size={18} color="#fff" />
        <Text style={styles.unlockButtonText}>Unlock Strength Score</Text>
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 14,
      marginTop: -43,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 16,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    sectionHeaderText: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.textPrimary,
      letterSpacing: -0.4,
    },
    heroCard: {
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: colors.surfaceCard,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
      paddingBottom: 16,
    },
    heroPadded: {
      paddingHorizontal: 14,
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingTop: 18,
      paddingBottom: 10,
    },
    heroLeft: {
      flex: 1,
      minWidth: 0,
      paddingRight: 12,
      gap: 8,
    },
    heroLevelName: {
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.65,
      lineHeight: 30,
    },
    heroScoreRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 6,
    },
    heroScorePlaceholder: {
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: 2,
    },
    heroScoreSuffix: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    heroProgressTrack: {
      height: 6,
      borderRadius: 999,
      width: "100%",
    },
    heroBadgeWrap: {
      opacity: 0.85,
    },
    bodyWrap: {
      opacity: isDark ? 0.85 : 0.9,
    },
    heroLegend: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 6,
      marginTop: 6,
    },
    lockedTagline: {
      fontSize: 13,
      fontWeight: "500",
      lineHeight: 18,
      color: colors.textSecondary,
      textAlign: "center",
      paddingHorizontal: 16,
      marginTop: 12,
    },
    unlockButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 16,
      gap: 12,
      marginTop: 16,
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 14,
      elevation: 6,
    },
    unlockButtonText: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: -0.2,
    },
  });
