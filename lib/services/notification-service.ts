import * as Notifications from 'expo-notifications'
import { database } from '@/lib/database'

const TRIAL_DURATION_DAYS = 7
const NOTIFICATION_ADVANCE_DAYS = 1 // Notify 1 day before expiration (on day 6)

/**
 * Schedule a notification to remind the user their trial is expiring
 * @param userId - The user's ID
 * @param trialStartDate - When the trial started
 * @returns The notification ID
 */
export async function scheduleTrialExpirationNotification(
  userId: string,
  trialStartDate: Date = new Date()
): Promise<string> {
  try {
    // Calculate when to send the notification (6 days after trial start)
    const notificationDate = new Date(trialStartDate)
    notificationDate.setDate(
      notificationDate.getDate() + TRIAL_DURATION_DAYS - NOTIFICATION_ADVANCE_DAYS
    )

    // Schedule the notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your trial ends tomorrow',
        body: 'Your 7-day free trial of Rep AI ends in 24 hours. Continue tracking your fitness journey!',
        data: {
          type: 'trial_expiration',
          userId,
          trialStartDate: trialStartDate.toISOString(),
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notificationDate,
      },
    })

    console.log('[NotificationService] Scheduled trial notification:', {
      notificationId,
      scheduledFor: notificationDate.toISOString(),
      trialStartDate: trialStartDate.toISOString(),
    })

    // Store the notification ID in the database
    await database.profiles.scheduleTrialNotification(
      userId,
      notificationId,
      notificationDate,
      trialStartDate
    )

    return notificationId
  } catch (error) {
    console.error('[NotificationService] Failed to schedule notification:', error)
    throw error
  }
}

/**
 * Cancel a scheduled trial expiration notification
 * @param userId - The user's ID
 */
export async function cancelTrialNotification(userId: string): Promise<void> {
  try {
    // Get the notification ID from the database
    const status = await database.profiles.getTrialNotificationStatus(userId)

    if (status.trial_notification_id) {
      // Cancel the notification
      await Notifications.cancelScheduledNotificationAsync(
        status.trial_notification_id
      )

      console.log('[NotificationService] Cancelled notification:', {
        notificationId: status.trial_notification_id,
        userId,
      })
    }

    // Clear the notification ID from the database
    await database.profiles.cancelTrialNotification(userId)
  } catch (error) {
    console.error('[NotificationService] Failed to cancel notification:', error)
    // Don't throw - cancellation failures shouldn't block other operations
  }
}

/**
 * Check if a trial notification needs to be rescheduled
 * (e.g., after app reinstall or if notification was missed)
 * @param userId - The user's ID
 * @param isProMember - Whether the user is currently a pro member
 */
export async function checkAndRescheduleTrialNotification(
  userId: string,
  isProMember: boolean
): Promise<void> {
  try {
    // Don't reschedule if user is already pro
    if (isProMember) {
      await cancelTrialNotification(userId)
      return
    }

    // Get the current notification status
    const status = await database.profiles.getTrialNotificationStatus(userId)

    // If no trial start date, nothing to reschedule
    if (!status.trial_start_date) {
      return
    }

    const trialStartDate = new Date(status.trial_start_date)
    const now = new Date()
    const trialEndDate = new Date(trialStartDate)
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS)

    // If trial has already ended, cancel any pending notifications
    if (now >= trialEndDate) {
      await cancelTrialNotification(userId)
      return
    }

    // Calculate when notification should be sent
    const notificationDate = new Date(trialStartDate)
    notificationDate.setDate(
      notificationDate.getDate() + TRIAL_DURATION_DAYS - NOTIFICATION_ADVANCE_DAYS
    )

    // If we're past the notification time, don't reschedule
    if (now >= notificationDate) {
      return
    }

    // If notification ID exists, check if it's still scheduled
    if (status.trial_notification_id) {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync()
      const exists = scheduled.some(
        (n) => n.identifier === status.trial_notification_id
      )

      // If notification still exists, no need to reschedule
      if (exists) {
        console.log('[NotificationService] Notification already scheduled')
        return
      }
    }

    // Reschedule the notification
    console.log('[NotificationService] Rescheduling notification')
    await scheduleTrialExpirationNotification(userId, trialStartDate)
  } catch (error) {
    console.error('[NotificationService] Failed to check/reschedule:', error)
    // Don't throw - rescheduling failures shouldn't block app functionality
  }
}

/**
 * Get all scheduled notifications (for debugging)
 */
export async function getAllScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync()
}
