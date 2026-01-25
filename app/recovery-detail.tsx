/**
 * Native Bottom Sheet for Recovery Detail
 * 
 * This screen is presented as a native formSheet using Expo Router.
 * It provides the same functionality as the old RecoveryDetailSheet component
 * but with native iOS sheet presentation (UISheetPresentationController).
 */

import { SlideUpView } from '@/components/slide-up-view'
import {
    getRecoveryColor,
    getRecoveryLabel,
    type RecoveryStatus,
    type WorkoutIntensity,
} from '@/hooks/useRecoveryData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function RecoveryDetailScreen() {
    const colors = useThemedColors()
    const insets = useSafeAreaInsets()
    const router = useRouter()
    const [shouldExit, setShouldExit] = useState(false)
    const params = useLocalSearchParams<{
        muscleGroup: string
        recoveryStatus: RecoveryStatus
        hoursSinceLastWorkout: string
        lastWorkedDate: string
        intensity: string
        recoveryTimeHours: string
        recoveryPercentage: string
    }>()

    // Parse params back to their proper types
    const muscleGroup = params.muscleGroup || ''
    const recoveryStatus = (params.recoveryStatus || 'untrained') as RecoveryStatus
    const hoursSinceLastWorkout = params.hoursSinceLastWorkout 
        ? parseFloat(params.hoursSinceLastWorkout) 
        : null
    const lastWorkedDate = params.lastWorkedDate 
        ? new Date(params.lastWorkedDate) 
        : null
    const intensity = (params.intensity || null) as WorkoutIntensity | null
    const recoveryTimeHours = params.recoveryTimeHours 
        ? parseFloat(params.recoveryTimeHours) 
        : null
    const recoveryPercentage = params.recoveryPercentage
        ? parseInt(params.recoveryPercentage)
        : 100

    const formatTimeAgo = (hours: number | null): string => {
        if (hours === null) return 'Never trained'

        if (hours < 1) {
            return 'Less than an hour ago'
        } else if (hours < 24) {
            const h = Math.floor(hours)
            return `${h} ${h === 1 ? 'hour' : 'hours'} ago`
        } else {
            const days = Math.floor(hours / 24)
            return `${days} ${days === 1 ? 'day' : 'days'} ago`
        }
    }

    const formatDate = (date: Date | null): string => {
        if (date === null) return '—'
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        })
    }

    const getRecoveryMessage = (status: RecoveryStatus): string => {
        switch (status) {
            case 'not_recovered':
                return 'This muscle needs more rest before your next workout. Training now could increase injury risk and reduce gains.'
            case 'recovering':
                return 'This muscle is still recovering. Light training is OK, but wait a bit longer for heavy lifts.'
            case 'recovered':
                return 'This muscle is recovered and ready for your next workout!'
            case 'untrained':
                return 'No workout data available for this muscle group yet.'
        }
    }

    const getRecoveryIcon = (
        status: RecoveryStatus
    ): keyof typeof Ionicons.glyphMap => {
        switch (status) {
            case 'not_recovered':
                return 'warning'
            case 'recovering':
                return 'time'
            case 'recovered':
                return 'checkmark-circle'
            case 'untrained':
                return 'help-circle'
        }
    }

    const formatIntensity = (int: WorkoutIntensity | null): string => {
        if (!int) return '—'
        return int.charAt(0).toUpperCase() + int.slice(1)
    }

    const formatRecoveryTime = (hours: number | null): string => {
        if (!hours) return '—'
        const h = Math.round(hours)
        if (h < 24) return `${h} hours`
        const days = Math.round(h / 24 * 10) / 10
        return `${days} days`
    }


    const statusColor = getRecoveryColor(recoveryStatus)
    const icon = getRecoveryIcon(recoveryStatus)
    const message = getRecoveryMessage(recoveryStatus)
    const timeAgo = formatTimeAgo(hoursSinceLastWorkout)
    const lastDate = formatDate(lastWorkedDate)

    const styles = createStyles(colors)

    return (
        <View style={styles.backdrop}>
            <TouchableOpacity
                style={styles.backdropPress}
                activeOpacity={1}
                onPress={() => setShouldExit(true)}
            />
            <SlideUpView
                style={styles.sheetWrapper}
                backgroundColor="transparent"
                shouldExit={shouldExit}
                onExitComplete={() => router.back()}
                duration={260}
                tension={50}
                friction={8}
            >
                <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 16 }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>{muscleGroup}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                            <Ionicons name={icon} size={16} color={statusColor} />
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {getRecoveryLabel(recoveryStatus)}
                            </Text>
                        </View>
                    </View>

                    {/* Message */}
                    <Text style={styles.message}>{message}</Text>

                    {/* Stats List */}
                    {recoveryStatus !== 'untrained' && (
                        <View style={styles.statsContainer}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Last Trained</Text>
                                <Text style={styles.infoValue}>{timeAgo}</Text>
                            </View>
                            <View style={styles.divider} />
                            
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Date</Text>
                                <Text style={styles.infoValue}>{lastDate}</Text>
                            </View>
                            <View style={styles.divider} />

                            {intensity && (
                                <>
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Workout Intensity</Text>
                                        <Text style={styles.infoValue}>{formatIntensity(intensity)}</Text>
                                    </View>
                                    <View style={styles.divider} />
                                </>
                            )}

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Recovery Progress</Text>
                                <Text style={[styles.infoValue, { color: statusColor }]}>{recoveryPercentage}%</Text>
                            </View>
                            <View style={styles.divider} />

                            {recoveryTimeHours && (
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Recovery Needed</Text>
                                    <Text style={styles.infoValue}>{formatRecoveryTime(recoveryTimeHours)}</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </SlideUpView>
        </View>
    )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
    StyleSheet.create({
        backdrop: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        backdropPress: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.25)',
        },
        sheetWrapper: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
        },
        sheetContainer: {
            backgroundColor: colors.surfaceSheet,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden',
            padding: 20,
            paddingTop: 16,
        },
        header: {
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 12,
        },
        title: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.textPrimary,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 100,
        },
        statusText: {
            fontSize: 13,
            fontWeight: '700',
        },
        message: {
            fontSize: 15,
            color: colors.textSecondary,
            lineHeight: 22,
        },
        statsContainer: {
            marginTop: 24,
            gap: 12,
        },
        infoRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 4,
        },
        infoLabel: {
            fontSize: 14,
            color: colors.textSecondary,
        },
        infoValue: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.textPrimary,
        },
        divider: {
            height: 1,
            backgroundColor: colors.border,
            opacity: 0.5,
        },
    })
