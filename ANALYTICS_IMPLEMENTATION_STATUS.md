# Analytics Implementation Status

## ✅ Completed (Phase 1-3)

### Phase 1: Foundation & Architecture
- ✅ Created `/constants/analytics-events.ts` with 50+ typed event constants and property interfaces
- ✅ Created `/utils/analytics-helpers.ts` with reusable tracking utilities:
  - `useTypedAnalytics()` - Type-safe event tracking
  - `useScreenView()` - Automatic screen tracking
  - `useErrorTracker()` - Error tracking wrapper
  - `useFeatureGate()` - Paywall tracking utilities
  - `usePerformanceTracker()` - Performance timing
  - `useDebouncedTracking()` - Debounced event tracking
  - Session management functions
- ✅ Enhanced `contexts/analytics-context.tsx`:
  - Added session ID to all events
  - Added automatic timestamp
  - Added development-mode validation
  - Added comprehensive error handling
  - Never crashes app on analytics failures

### Phase 2: Fixed Existing Events
- ✅ Renamed overloaded "Workout Create Saved" to 4 distinct events:
  - `WORKOUT_DRAFT_AUTO_SAVED` - Auto-save drafts
  - `WORKOUT_SAVED_TO_PENDING` - Before API submission
  - `WORKOUT_CREATION_CANCELLED` - User cancels
  - `WORKOUT_DELETE_CONFIRMED` - Workout deleted
- ✅ Added `WORKOUT_DELETE_REQUESTED` for delete button tap
- ✅ Fixed timing issues:
  - Changed `Explore Viewed` from `useEffect` to `useFocusEffect` (tracks each visit)
  - Added session tracking to `App Open` (fires once per session)
- ✅ Updated all events to use constants from `AnalyticsEvents`:
  - `app/(tabs)/create-post.tsx`
  - `app/(tabs)/create-speech.tsx`
  - `app/(tabs)/index.tsx`
  - `app/(tabs)/explore.tsx`
  - `app/_layout.tsx`
  - `app/body-log/intro.tsx`
  - `components/workout-chat.tsx`

### Phase 3: Enhanced Onboarding & Initial Auth
- ✅ Complete onboarding data capture:
  - Added height, weight, commitment, training_years, bio to `ONBOARDING_COMPLETED`
  - Changed `Onboarding Step Viewed` to `ONBOARDING_STEP_COMPLETED` (more accurate)
- ✅ Added `AUTH_WELCOME_VIEWED` to welcome screen
- ✅ Added `AUTH_SIGNIN_STARTED` to signin-email screen

## 🚧 In Progress (Need to Complete)

### Authentication Events (70% complete)
- ✅ `AUTH_WELCOME_VIEWED` - app/(auth)/welcome.tsx
- ✅ `AUTH_SIGNIN_STARTED` - app/(auth)/signin-email.tsx
- ⏳ Need: `AUTH_SIGNIN_COMPLETED` - app/(auth)/signin-password.tsx
- ⏳ Need: `AUTH_SIGNIN_FAILED` - app/(auth)/signin-password.tsx
- ⏳ Need: `AUTH_SIGNUP_STARTED` - app/(auth)/signup-email.tsx
- ⏳ Need: `AUTH_SIGNUP_COMPLETED` - (check auth context or signup flow)
- ⏳ Need: `AUTH_SIGNUP_FAILED` - (check signup flow)
- ⏳ Need: `AUTH_SIGNOUT` - (find logout button/function)

## 📝 Pending (Not Started)

### Paywall Conversion Events
**Files to modify:**
- `app/(tabs)/create-post.tsx:569`
- `app/(tabs)/create-speech.tsx:62`
- `app/body-log/intro.tsx:40`
- `components/workout-chat.tsx:80`

**Add:**
- `PAYWALL_CTA_TAPPED` - when user taps "Start Trial" or purchase button
- `PAYWALL_DISMISSED` - when user closes paywall
- `PAYWALL_PURCHASED` - after successful purchase

### Subscription Lifecycle
**File to modify:** `app/(auth)/trial-offer.tsx`

**Add:**
- `SUBSCRIPTION_TRIAL_STARTED`
- `SUBSCRIPTION_PURCHASED` (with plan, price, currency)
- `SUBSCRIPTION_CANCELLED`
- `SUBSCRIPTION_RESTORED`

### Workout Interactions
**Files to modify:**
- `components/animated-feed-card.tsx` - Card taps, expands
- `app/edit-workout/[workoutId].tsx` - Edit started, completed, cancelled

**Add:**
- `WORKOUT_CARD_TAPPED`
- `WORKOUT_CARD_EXPANDED`
- `WORKOUT_CARD_COLLAPSED`
- `WORKOUT_EDIT_STARTED`
- `WORKOUT_EDIT_COMPLETED`
- `WORKOUT_EDIT_CANCELLED`

### AI Chat Events
**File to modify:** `components/workout-chat.tsx`

**Add:**
- `AI_CHAT_OPENED`
- `AI_CHAT_MESSAGE_SENT` (with message_length)
- `AI_CHAT_RESPONSE_RECEIVED` (with response_time)
- `AI_CHAT_ERROR` (with error_message)
- `AI_CHAT_CLOSED`

### Body Scanning Events
**Files to modify:**
- `app/body-log/intro.tsx` - Intro viewed, started
- `app/body-log/processing.tsx` - Processing started
- `app/body-log/[imageId].tsx` - Scan completed, viewed
- `app/body-log/index.tsx` - List viewed

**Add:**
- `BODY_SCAN_INTRO_VIEWED`
- `BODY_SCAN_STARTED`
- `BODY_SCAN_IMAGE_CAPTURED`
- `BODY_SCAN_PROCESSING_STARTED`
- `BODY_SCAN_COMPLETED`
- `BODY_SCAN_FAILED`
- `BODY_SCAN_IMAGE_VIEWED`

### Analytics Views (Charts & Leaderboards)
**Files to modify:**
- `components/strength-score-chart.tsx` - Add view tracking
- `components/muscle-balance-chart.tsx` - Add view tracking
- `components/exercise-leaderboard-card.tsx` - Add view and tap tracking

**Add:**
- `STRENGTH_SCORE_VIEWED`
- `MUSCLE_BALANCE_VIEWED`
- `LEADERBOARD_VIEWED`
- `LEADERBOARD_EXERCISE_TAPPED`

### Social Features
**Files to modify:**
- `app/user/[userId].tsx` - Profile views, follow/unfollow

**Add:**
- `USER_PROFILE_VIEWED` (with user_id, is_self, follower_count)
- `USER_FOLLOWED`
- `USER_UNFOLLOWED`

### Profile & Settings
**Files to modify:**
- `app/edit-profile.tsx` - Profile edits
- `app/settings.tsx` - Settings changes

**Add:**
- `PROFILE_VIEWED`
- `PROFILE_EDIT_STARTED`
- `PROFILE_EDIT_COMPLETED` (with fields_changed[])
- `PROFILE_EDIT_CANCELLED`
- `SETTINGS_VIEWED`
- `SETTING_CHANGED` (with setting_name, setting_value, previous_value)

### Notifications
**File to modify:** `app/notifications.tsx`

**Add:**
- `NOTIFICATIONS_VIEWED`
- `NOTIFICATION_TAPPED` (with notification_id, notification_type)

### Error Tracking
**Files to modify:**
- `hooks/useAudioTranscription.ts`
- `hooks/useImageTranscription.ts`

**Add:**
- `TRANSCRIPTION_STARTED` (with mode: 'audio' | 'image')
- `TRANSCRIPTION_COMPLETED` (with duration, file_size)
- `TRANSCRIPTION_FAILED` (with error_message)
- `IMAGE_SCAN_STARTED`
- `IMAGE_SCAN_COMPLETED`
- `IMAGE_SCAN_FAILED`

### Performance Tracking
**Locations:** Wherever transcription, image processing, API calls happen

**Add:**
- Track duration of key operations
- Track success/failure rates

## 📊 Current Coverage Stats

**Before:** ~25% coverage (8 event types)
**After Foundation:** ~40% coverage (架构 + renamed events + fixed issues)
**Target:** ~90% coverage

## 🎯 Quick Implementation Guide

### To Add a New Event:

1. **Import the constant:**
   ```typescript
   import { AnalyticsEvents } from '@/constants/analytics-events'
   import { useAnalytics } from '@/contexts/analytics-context'
   ```

2. **Get the tracking function:**
   ```typescript
   const { trackEvent } = useAnalytics()
   ```

3. **Track the event:**
   ```typescript
   trackEvent(AnalyticsEvents.YOUR_EVENT_NAME, {
     property1: value1,
     property2: value2,
     timestamp: Date.now(), // Added automatically, but you can override
   })
   ```

### For Screen Views:

Use the helper hook:
```typescript
import { useScreenView } from '@/utils/analytics-helpers'

// In your component:
useScreenView('Screen Name', { additional: 'properties' })
```

### For Error Tracking:

```typescript
import { useErrorTracker } from '@/utils/analytics-helpers'

const trackError = useErrorTracker()

try {
  await riskyOperation()
} catch (error) {
  trackError(error, {
    errorType: 'api',
    endpoint: '/workouts'
  })
}
```

### For Paywall Tracking:

```typescript
import { useFeatureGate } from '@/utils/analytics-helpers'

const { trackPaywallShown, trackPaywallCTATapped, trackPaywallDismissed, trackPaywallPurchased } = useFeatureGate()

// When showing paywall:
trackPaywallShown('workout_logging', 'create-post', 'none')

// When user taps CTA:
trackPaywallCTATapped('workout_logging', 'create-post')

// When dismissed:
trackPaywallDismissed('workout_logging', 'create-post')

// After purchase:
trackPaywallPurchased('workout_logging', 'create-post')
```

## 🔍 Testing Checklist

After implementation, verify:
- [ ] All events fire in development console
- [ ] No crashes from analytics errors
- [ ] Session ID is present on all events
- [ ] Timestamps are correct
- [ ] Super properties (appVersion, platform) are present
- [ ] User identification works after login
- [ ] Events appear in PostHog dashboard

## 📚 Documentation

- All events are documented in `/constants/analytics-events.ts` with JSDoc comments
- Property types are strongly typed with TypeScript interfaces
- Helper functions have usage examples in `/utils/analytics-helpers.ts`

## 🚀 Next Steps

1. **Complete authentication events** (signin-password, signup flows, logout)
2. **Add paywall conversion tracking** (CTA tapped, dismissed, purchased)
3. **Add subscription lifecycle events** (trial-offer.tsx)
4. **Add workout interaction events** (feed card taps, edits)
5. **Add AI chat tracking** (messages sent/received)
6. **Add body scan events** (full flow tracking)
7. **Add analytics views tracking** (charts, leaderboards)
8. **Add social features tracking** (profile views, follows)
9. **Add settings/profile events**
10. **Add notification tracking**
11. **Add error tracking to transcription hooks**
12. **Add performance tracking**

Estimated time remaining: **4-5 hours** for complete implementation.
