/**
 * Analytics Event Constants
 *
 * This file contains all analytics event names and their property types.
 * Use these constants instead of string literals for type safety and autocomplete.
 */

// ============================================================================
// EVENT NAMES
// ============================================================================

export const AnalyticsEvents = {
  // App Lifecycle
  APP_OPEN: 'App Open',
  APP_BACKGROUND: 'App Background',
  APP_FOREGROUND: 'App Foreground',
  SCREEN_VIEWED: 'Screen Viewed',

  // Authentication
  AUTH_WELCOME_VIEWED: 'Auth Welcome Viewed',
  AUTH_SIGNUP_STARTED: 'Auth Sign Up Started',
  AUTH_SIGNUP_COMPLETED: 'Auth Sign Up Completed',
  AUTH_SIGNUP_FAILED: 'Auth Sign Up Failed',
  AUTH_SIGNIN_STARTED: 'Auth Sign In Started',
  AUTH_SIGNIN_COMPLETED: 'Auth Sign In Completed',
  AUTH_SIGNIN_FAILED: 'Auth Sign In Failed',
  AUTH_SIGNOUT: 'Auth Sign Out',
  AUTH_PASSWORD_RESET_REQUESTED: 'Auth Password Reset Requested',

  // Onboarding
  ONBOARDING_STEP_VIEWED: 'Onboarding Step Viewed',
  ONBOARDING_STEP_COMPLETED: 'Onboarding Step Completed',
  ONBOARDING_STEP_SKIPPED: 'Onboarding Step Skipped',
  ONBOARDING_COMPLETED: 'Onboarding Completed',
  PROCESSING_STARTED: 'Processing Started',
  PROCESSING_COMPLETED: 'Processing Completed',
  REVIEW_PROMPT_ONBOARDING_VIEWED: 'Review Prompt Onboarding Viewed',
  REVIEW_PROMPT_ONBOARDING_ACCEPTED: 'Review Prompt Onboarding Accepted',
  REVIEW_PROMPT_ONBOARDING_DISMISSED: 'Review Prompt Onboarding Dismissed',
  TRIAL_OFFER_VIEWED: 'Trial Offer Viewed',
  TRIAL_OFFER_STEP_VIEWED: 'Trial Offer Step Viewed',
  TRIAL_OFFER_STEP_COMPLETED: 'Trial Offer Step Completed',
  TRIAL_OFFER_ACCEPTED: 'Trial Offer Accepted',
  TRIAL_OFFER_DISMISSED: 'Trial Offer Dismissed',
  TRIAL_OFFER_SKIPPED: 'Trial Offer Skipped',

  // Feed & Navigation
  FEED_VIEWED: 'Feed Viewed',
  FEED_REFRESHED: 'Feed Refreshed',
  EXPLORE_VIEWED: 'Explore Viewed',
  EXPLORE_REFRESHED: 'Explore Refreshed',

  // Workout Creation
  WORKOUT_CREATE_STARTED: 'Workout Create Started',
  WORKOUT_DRAFT_AUTO_SAVED: 'Workout Draft Auto-Saved',
  WORKOUT_SAVED_TO_PENDING: 'Workout Saved To Pending',
  WORKOUT_CREATE_SUBMITTED: 'Workout Create Submitted',
  WORKOUT_CREATION_CANCELLED: 'Workout Creation Cancelled',

  // Workout Interactions
  WORKOUT_CARD_TAPPED: 'Workout Card Tapped',
  WORKOUT_CARD_EXPANDED: 'Workout Card Expanded',
  WORKOUT_CARD_COLLAPSED: 'Workout Card Collapsed',
  WORKOUT_EDIT_STARTED: 'Workout Edit Started',
  WORKOUT_EDIT_COMPLETED: 'Workout Edit Completed',
  WORKOUT_EDIT_CANCELLED: 'Workout Edit Cancelled',
  WORKOUT_DELETE_REQUESTED: 'Workout Delete Requested',
  WORKOUT_DELETE_CONFIRMED: 'Workout Delete Confirmed',
  WORKOUT_DELETE_CANCELLED: 'Workout Delete Cancelled',
  WORKOUT_SHARE_INITIATED: 'Workout Share Initiated',
  WORKOUT_SHARE_COMPLETED: 'Workout Share Completed',
  WORKOUT_SHARE_FAILED: 'Workout Share Failed',

  // AI Chat
  AI_CHAT_OPENED: 'AI Chat Opened',
  AI_CHAT_MESSAGE_SENT: 'AI Chat Message Sent',
  AI_CHAT_RESPONSE_RECEIVED: 'AI Chat Response Received',
  AI_CHAT_ERROR: 'AI Chat Error',
  AI_CHAT_CLOSED: 'AI Chat Closed',

  // Body Scanning
  BODY_SCAN_INTRO_VIEWED: 'Body Scan Intro Viewed',
  BODY_SCAN_STARTED: 'Body Scan Started',
  BODY_SCAN_IMAGE_CAPTURED: 'Body Scan Image Captured',
  BODY_SCAN_PROCESSING_STARTED: 'Body Scan Processing Started',
  BODY_SCAN_COMPLETED: 'Body Scan Completed',
  BODY_SCAN_FAILED: 'Body Scan Failed',
  BODY_SCAN_IMAGE_VIEWED: 'Body Scan Image Viewed',

  // Analytics & Insights
  STRENGTH_SCORE_VIEWED: 'Strength Score Viewed',
  MUSCLE_BALANCE_VIEWED: 'Muscle Balance Viewed',

  // Social Features
  USER_PROFILE_VIEWED: 'User Profile Viewed',
  USER_FOLLOWED: 'User Followed',
  USER_UNFOLLOWED: 'User Unfollowed',

  // Profile & Settings
  PROFILE_VIEWED: 'Profile Viewed',
  PROFILE_EDIT_STARTED: 'Profile Edit Started',
  PROFILE_EDIT_COMPLETED: 'Profile Edit Completed',
  PROFILE_EDIT_CANCELLED: 'Profile Edit Cancelled',
  SETTINGS_VIEWED: 'Settings Viewed',
  SETTING_CHANGED: 'Setting Changed',

  // Notifications
  NOTIFICATIONS_VIEWED: 'Notifications Viewed',
  NOTIFICATION_TAPPED: 'Notification Tapped',

  // Monetization & Paywall
  PAYWALL_SHOWN: 'Paywall Shown',
  PAYWALL_CTA_TAPPED: 'Paywall CTA Tapped',
  PAYWALL_DISMISSED: 'Paywall Dismissed',
  PAYWALL_PURCHASED: 'Paywall Purchased',

  // Subscriptions
  SUBSCRIPTION_TRIAL_STARTED: 'Subscription Trial Started',
  SUBSCRIPTION_PURCHASED: 'Subscription Purchased',
  SUBSCRIPTION_CANCELLED: 'Subscription Cancelled',
  SUBSCRIPTION_RESTORED: 'Subscription Restored',
  SUBSCRIPTION_EXPIRED: 'Subscription Expired',

  // Errors & Performance
  API_ERROR: 'API Error',
  NETWORK_ERROR: 'Network Error',
  TRANSCRIPTION_STARTED: 'Transcription Started',
  TRANSCRIPTION_COMPLETED: 'Transcription Completed',
  TRANSCRIPTION_FAILED: 'Transcription Failed',
  IMAGE_SCAN_STARTED: 'Image Scan Started',
  IMAGE_SCAN_COMPLETED: 'Image Scan Completed',
  IMAGE_SCAN_FAILED: 'Image Scan Failed',
} as const

export type AnalyticsEvent = typeof AnalyticsEvents[keyof typeof AnalyticsEvents]

// ============================================================================
// EVENT PROPERTY TYPES
// ============================================================================

export interface BaseEventProperties {
  timestamp?: number
  [key: string]: unknown
}

export interface AppOpenProperties extends BaseEventProperties {
  segment?: string
  is_first_open?: boolean
  session_id?: string
}

export interface ScreenViewedProperties extends BaseEventProperties {
  screen_name: string
  previous_screen?: string
}

export interface AuthSignupProperties extends BaseEventProperties {
  method?: 'email' | 'google' | 'apple'
  email?: string
}

export interface AuthSigninProperties extends BaseEventProperties {
  method?: 'email' | 'google' | 'apple'
  email?: string
}

export interface AuthErrorProperties extends BaseEventProperties {
  error_message?: string
  error_code?: string
}

export interface OnboardingStepProperties extends BaseEventProperties {
  step: number
  step_name?: string
}

export interface OnboardingCompletedProperties extends BaseEventProperties {
  name?: string
  goal?: string[]
  age?: number | null
  gender?: string | null
  height?: number | null
  weight?: number | null
  commitment?: string | null
  training_years?: number | null
  bio?: string | null
}

export interface ProcessingProperties extends BaseEventProperties {
  duration?: number
}

export interface TrialOfferStepProperties extends BaseEventProperties {
  step: number
  step_name?: 'intro' | 'benefits' | 'payment_setup'
}

export interface TrialOfferProperties extends BaseEventProperties {
  action?: 'viewed' | 'step_viewed' | 'step_completed' | 'accepted' | 'dismissed'
}

export interface FeedViewedProperties extends BaseEventProperties {
  workoutCount?: number
}

export interface WorkoutCreateStartedProperties extends BaseEventProperties {
  mode?: 'text' | 'speech' | 'camera'
  hasDraft?: boolean
  hasTitle?: boolean
}

export interface WorkoutDraftProperties extends BaseEventProperties {
  length: number
  hasTitle: boolean
  auto_save?: boolean
}

export interface WorkoutSubmittedProperties extends BaseEventProperties {
  mode?: 'text' | 'speech' | 'camera'
  hasTitle?: boolean
  length?: number
  exercises?: number
  workout_id?: string
}

export interface WorkoutCancelledProperties extends BaseEventProperties {
  mode?: 'text' | 'speech' | 'camera'
  isRecording?: boolean
  draft_length?: number
}

export interface WorkoutCardProperties extends BaseEventProperties {
  workout_id: string
  author_id?: string
  exercise_count?: number
}

export interface WorkoutEditProperties extends BaseEventProperties {
  workout_id: string
  changes?: string[]
}

export interface WorkoutDeleteProperties extends BaseEventProperties {
  workout_id: string
  action?: 'requested' | 'confirmed' | 'cancelled'
}

export interface WorkoutShareProperties extends BaseEventProperties {
  workout_id: string
  exercise_count?: number
  has_image?: boolean
  share_platform?: string
  generation_time?: number
  error_message?: string
}

export interface AIChatProperties extends BaseEventProperties {
  workout_id?: string
  message_length?: number
  response_time?: number
  error_message?: string
}

export interface BodyScanProperties extends BaseEventProperties {
  scan_id?: string
  processing_time?: number
  error_message?: string
}

export interface AnalyticsViewProperties extends BaseEventProperties {
  view_type: 'strength_score' | 'muscle_balance'
  exercise?: string
}

export interface UserProfileProperties extends BaseEventProperties {
  user_id: string
  is_self?: boolean
  follower_count?: number
  following_count?: number
}

export interface SocialActionProperties extends BaseEventProperties {
  user_id: string
  action: 'follow' | 'unfollow'
}

export interface ProfileEditProperties extends BaseEventProperties {
  fields_changed?: string[]
}

export interface SettingProperties extends BaseEventProperties {
  setting_name: string
  setting_value?: string | boolean | number
  previous_value?: string | boolean | number
}

export interface NotificationProperties extends BaseEventProperties {
  notification_id?: string
  notification_type?: string
}

export interface PaywallProperties extends BaseEventProperties {
  feature: 'workout_logging' | 'voice_logging' | 'body_scan' | 'ai_chat'
  source_screen?: string
  subscription_status?: 'active' | 'trial' | 'expired' | 'none'
  action?: 'shown' | 'cta_tapped' | 'dismissed' | 'purchased'
}

export interface SubscriptionProperties extends BaseEventProperties {
  plan?: string
  price?: number
  currency?: string
  trial_duration?: number
  source?: string
}

export interface ErrorProperties extends BaseEventProperties {
  error_type: 'api' | 'network' | 'transcription' | 'image_scan' | 'unknown'
  error_message?: string
  error_code?: string
  endpoint?: string
  status_code?: number
}

export interface TranscriptionProperties extends BaseEventProperties {
  mode: 'audio' | 'image'
  duration?: number
  file_size?: number
  success?: boolean
  error_message?: string
}

export interface PerformanceProperties extends BaseEventProperties {
  operation: string
  duration: number
  success: boolean
}

// ============================================================================
// TYPE MAP - Maps event names to their property types
// ============================================================================

export type EventPropertiesMap = {
  [AnalyticsEvents.APP_OPEN]: AppOpenProperties
  [AnalyticsEvents.SCREEN_VIEWED]: ScreenViewedProperties
  [AnalyticsEvents.AUTH_SIGNUP_STARTED]: AuthSignupProperties
  [AnalyticsEvents.AUTH_SIGNUP_COMPLETED]: AuthSignupProperties
  [AnalyticsEvents.AUTH_SIGNUP_FAILED]: AuthErrorProperties
  [AnalyticsEvents.AUTH_SIGNIN_STARTED]: AuthSigninProperties
  [AnalyticsEvents.AUTH_SIGNIN_COMPLETED]: AuthSigninProperties
  [AnalyticsEvents.AUTH_SIGNIN_FAILED]: AuthErrorProperties
  [AnalyticsEvents.ONBOARDING_STEP_VIEWED]: OnboardingStepProperties
  [AnalyticsEvents.ONBOARDING_STEP_COMPLETED]: OnboardingStepProperties
  [AnalyticsEvents.ONBOARDING_COMPLETED]: OnboardingCompletedProperties
  [AnalyticsEvents.PROCESSING_STARTED]: ProcessingProperties
  [AnalyticsEvents.PROCESSING_COMPLETED]: ProcessingProperties
  [AnalyticsEvents.TRIAL_OFFER_VIEWED]: TrialOfferProperties
  [AnalyticsEvents.TRIAL_OFFER_STEP_VIEWED]: TrialOfferStepProperties
  [AnalyticsEvents.TRIAL_OFFER_STEP_COMPLETED]: TrialOfferStepProperties
  [AnalyticsEvents.TRIAL_OFFER_ACCEPTED]: TrialOfferProperties
  [AnalyticsEvents.TRIAL_OFFER_DISMISSED]: TrialOfferProperties
  [AnalyticsEvents.TRIAL_OFFER_SKIPPED]: TrialOfferProperties
  [AnalyticsEvents.FEED_VIEWED]: FeedViewedProperties
  [AnalyticsEvents.WORKOUT_CREATE_STARTED]: WorkoutCreateStartedProperties
  [AnalyticsEvents.WORKOUT_DRAFT_AUTO_SAVED]: WorkoutDraftProperties
  [AnalyticsEvents.WORKOUT_SAVED_TO_PENDING]: WorkoutDraftProperties
  [AnalyticsEvents.WORKOUT_CREATE_SUBMITTED]: WorkoutSubmittedProperties
  [AnalyticsEvents.WORKOUT_CREATION_CANCELLED]: WorkoutCancelledProperties
  [AnalyticsEvents.WORKOUT_CARD_TAPPED]: WorkoutCardProperties
  [AnalyticsEvents.WORKOUT_CARD_EXPANDED]: WorkoutCardProperties
  [AnalyticsEvents.WORKOUT_EDIT_STARTED]: WorkoutEditProperties
  [AnalyticsEvents.WORKOUT_EDIT_COMPLETED]: WorkoutEditProperties
  [AnalyticsEvents.WORKOUT_DELETE_REQUESTED]: WorkoutDeleteProperties
  [AnalyticsEvents.WORKOUT_DELETE_CONFIRMED]: WorkoutDeleteProperties
  [AnalyticsEvents.WORKOUT_SHARE_INITIATED]: WorkoutShareProperties
  [AnalyticsEvents.WORKOUT_SHARE_COMPLETED]: WorkoutShareProperties
  [AnalyticsEvents.WORKOUT_SHARE_FAILED]: WorkoutShareProperties
  [AnalyticsEvents.AI_CHAT_MESSAGE_SENT]: AIChatProperties
  [AnalyticsEvents.AI_CHAT_RESPONSE_RECEIVED]: AIChatProperties
  [AnalyticsEvents.AI_CHAT_ERROR]: AIChatProperties
  [AnalyticsEvents.BODY_SCAN_STARTED]: BodyScanProperties
  [AnalyticsEvents.BODY_SCAN_COMPLETED]: BodyScanProperties
  [AnalyticsEvents.BODY_SCAN_FAILED]: BodyScanProperties
  [AnalyticsEvents.STRENGTH_SCORE_VIEWED]: AnalyticsViewProperties
  [AnalyticsEvents.MUSCLE_BALANCE_VIEWED]: AnalyticsViewProperties
  [AnalyticsEvents.USER_PROFILE_VIEWED]: UserProfileProperties
  [AnalyticsEvents.USER_FOLLOWED]: SocialActionProperties
  [AnalyticsEvents.USER_UNFOLLOWED]: SocialActionProperties
  [AnalyticsEvents.PROFILE_EDIT_STARTED]: ProfileEditProperties
  [AnalyticsEvents.PROFILE_EDIT_COMPLETED]: ProfileEditProperties
  [AnalyticsEvents.SETTING_CHANGED]: SettingProperties
  [AnalyticsEvents.NOTIFICATION_TAPPED]: NotificationProperties
  [AnalyticsEvents.PAYWALL_SHOWN]: PaywallProperties
  [AnalyticsEvents.PAYWALL_CTA_TAPPED]: PaywallProperties
  [AnalyticsEvents.PAYWALL_DISMISSED]: PaywallProperties
  [AnalyticsEvents.PAYWALL_PURCHASED]: PaywallProperties
  [AnalyticsEvents.SUBSCRIPTION_TRIAL_STARTED]: SubscriptionProperties
  [AnalyticsEvents.SUBSCRIPTION_PURCHASED]: SubscriptionProperties
  [AnalyticsEvents.SUBSCRIPTION_CANCELLED]: SubscriptionProperties
  [AnalyticsEvents.API_ERROR]: ErrorProperties
  [AnalyticsEvents.NETWORK_ERROR]: ErrorProperties
  [AnalyticsEvents.TRANSCRIPTION_STARTED]: TranscriptionProperties
  [AnalyticsEvents.TRANSCRIPTION_COMPLETED]: TranscriptionProperties
  [AnalyticsEvents.TRANSCRIPTION_FAILED]: TranscriptionProperties
}
