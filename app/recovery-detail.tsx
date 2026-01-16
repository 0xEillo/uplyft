/**
 * Native Bottom Sheet for Recovery Detail
 * 
 * This screen is presented as a native formSheet using Expo Router.
 * It provides the same functionality as the old RecoveryDetailSheet component
 * but with native iOS sheet presentation (UISheetPresentationController).
 */

import {
    getRecoveryColor,
    getRecoveryLabel,
    type RecoveryStatus,
    type WorkoutIntensity,
} from '@/hooks/useRecoveryData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import React from 'react'
import {
    StyleSheet,
    Text,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function RecoveryDetailScreen() {
    const colors = useThemedColors()
    const insets = useSafeAreaInsets()
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
        <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>{muscleGroup}</Text>
            </View>

            {/* Status Badge */}
            <View style={styles.statusSection}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Ionicons name={icon} size={20} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                        {getRecoveryLabel(recoveryStatus)}
                    </Text>
                </View>
            </View>

            {/* Last Worked Info */}
            {recoveryStatus !== 'untrained' && (
                <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Last Trained</Text>
                        <Text style={styles.infoValue}>{timeAgo}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Date</Text>
                        <Text style={styles.infoValue}>{lastDate}</Text>
                    </View>
                    {intensity && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Workout Intensity</Text>
                            <Text style={styles.infoValue}>{formatIntensity(intensity)}</Text>
                        </View>
                    )}
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Recovery Progress</Text>
                        <Text style={[styles.infoValue, { color: statusColor }]}>{recoveryPercentage}%</Text>
                    </View>
                    {recoveryTimeHours && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Recovery Needed</Text>
                            <Text style={styles.infoValue}>{formatRecoveryTime(recoveryTimeHours)}</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Message */}
            <View style={styles.messageSection}>
                <Text style={styles.message}>{message}</Text>
            </View>
        </View>
    )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
            padding: 20,
            paddingTop: 16,
        },
        header: {
            marginBottom: 16,
        },
        title: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.text,
        },
        statusSection: {
            alignItems: 'flex-start',
            marginBottom: 20,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
        },
        statusText: {
            fontSize: 14,
            fontWeight: '700',
        },
        infoSection: {
            backgroundColor: colors.backgroundLight,
            borderRadius: 12,
            padding: 16,
            gap: 12,
            marginBottom: 16,
        },
        infoRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        infoLabel: {
            fontSize: 14,
            color: colors.textSecondary,
        },
        infoValue: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        messageSection: {
            backgroundColor: colors.backgroundLight,
            borderRadius: 12,
            padding: 16,
        },
        message: {
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 20,
        },
    })
