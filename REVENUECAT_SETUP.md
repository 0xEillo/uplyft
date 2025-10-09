# RevenueCat 3-Day Free Trial Setup Guide

This guide will help you complete the setup of the 3-day free trial subscription integration in your workout tracker app.

## Overview

The app now has:

- ✅ RevenueCat SDK integration
- ✅ Subscription context with trial management
- ✅ 3-day free trial offer during onboarding
- ✅ Trial and subscription checks before workout logging
- ✅ Paywall UI for subscription purchases
- ✅ Subscription status display in settings
- ✅ Database migration for subscription and trial tracking

## User Experience Flow

### During Onboarding

1. User completes profile setup
2. User rates the app
3. **Trial Offer Screen** - User is presented with trial offer (final onboarding step)
   - Option A: "Start Free Trial" → Activates 3-day trial, redirects to main app
   - Option B: "Maybe Later" → Skip trial, redirects to main app

### Free Trial Active

- Full access to all features for 3 days
- Can log unlimited workouts
- Settings shows "Free Trial Active" with days remaining
- Auto-converts to paid subscription after 3 days (handled by App Store/Google Play)

### No Trial / Trial Expired

- Can browse the app and view past workouts
- **Blocked** at workout creation screens
- Alert: "Start your free trial or subscribe to log workouts!"
- Shown paywall when attempting to log workouts

## Next Steps

### 1. Install Dependencies

Run the following command to install the RevenueCat SDK:

```bash
npm install
```

Then rebuild your native apps:

```bash
# For iOS
npm run ios

# For Android
npm run android
```

### 2. Configure RevenueCat Account

1. **Create a RevenueCat account** at https://www.revenuecat.com/

2. **Create a new project** in RevenueCat dashboard

3. **Add your iOS app:**

   - Go to Project Settings > Apps
   - Add iOS app with your Bundle ID
   - Copy the **iOS API Key**

4. **Add your Android app:**
   - Go to Project Settings > Apps
   - Add Android app with your Package Name
   - Copy the **Android API Key**

### 3. Update API Keys

Open `contexts/subscription-context.tsx` and replace the placeholder API keys:

```typescript
// Lines 39-40
const REVENUECAT_IOS_API_KEY = 'your_actual_ios_api_key_here'
const REVENUECAT_ANDROID_API_KEY = 'your_actual_android_api_key_here'
```

**⚠️ IMPORTANT:** For production, store these keys securely using environment variables or a secrets management service.

### 4. Configure In-App Purchases with Free Trial

#### iOS (App Store Connect)

1. Log in to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select your app
3. Go to **Features** > **In-App Purchases**
4. Create a new **Auto-Renewable Subscription**:
   - Product ID: `monthly_premium` (or your choice)
   - Subscription Group: Create a new one
   - Price: \$5.99/month
   - **Free Trial**: Enable 3-day free trial
   - Billing period: 1 month
5. Submit for review

#### Android (Google Play Console)

1. Log in to [Google Play Console](https://play.google.com/console/)
2. Select your app
3. Go to **Monetize** > **Subscriptions**
4. Create a new subscription:
   - Product ID: `monthly_premium` (should match iOS)
   - Base plan: 1 month
   - Price: \$5.99/month
   - **Free trial period**: 3 days
5. Activate subscription

### 5. Configure RevenueCat Products

1. In RevenueCat dashboard, go to **Products**
2. Click **+ New** to create a product
3. Link your App Store and Google Play product IDs
4. Create an **Entitlement** called `premium`
5. Create an **Offering** (use default or custom name)
6. Add your product to the offering
7. **Important**: Ensure the product includes the 3-day free trial period

**⚠️ IMPORTANT:** The entitlement identifier must be `premium` (as used in the code), or update line 130 in `contexts/subscription-context.tsx` to match your entitlement name.

### 6. Run Database Migration

Apply the subscription and trial tracking migration to your Supabase database:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the SQL in Supabase dashboard
# File: supabase/migrations/20251008174826_add_subscription_tracking.sql
```

### 7. Test the Integration

#### Testing on iOS

1. Use a **Sandbox Tester** account from App Store Connect
2. Sign out of your Apple ID in Settings
3. Complete onboarding to reach trial offer screen
4. Start trial - it should be free and immediate
5. Try logging workouts - should work during trial
6. Test trial expiration (you may need to manually advance time or wait)

#### Testing on Android

1. Add test accounts in Google Play Console
2. Use a test account to sign in
3. Complete onboarding flow
4. Test trial activation and workout logging
5. Verify trial behavior

### 8. Webhook Setup (Optional but Recommended)

To sync subscription status with your database:

1. In RevenueCat dashboard, go to **Integrations** > **Webhooks**
2. Add webhook URL: `https://your-app.com/api/revenuecat-webhook`
3. Select events to listen for:
   - INITIAL_PURCHASE
   - RENEWAL
   - CANCELLATION
   - EXPIRATION
   - TRIAL_STARTED
   - TRIAL_CANCELLED
4. Create the webhook handler in your API to update the `profiles` table

## How It Works

### Trial Model

- **3-day free trial** offered as final onboarding step
- Trial starts when user taps "Start Free Trial" in trial-offer screen
- RevenueCat handles the trial subscription purchase (no charge)
- Local tracking via AsyncStorage for quick checks
- Database stores trial dates for analytics (optional)

### Access Control

**During Trial (Days 1-3):**

- Full access to all features
- Can log unlimited workouts
- Settings shows "Free Trial Active" with countdown

**After Trial Expires:**

- Auto-converts to paid subscription (\$5.99/month)
- If payment fails or user cancels → blocked at workout creation
- Can still browse app and view past workouts

**No Trial Started:**

- Can browse app
- Blocked at workout creation screens
- Shown paywall with trial offer

### Subscription Checking

The app checks subscription/trial status:

- On app launch (via `SubscriptionProvider`)
- Before workout creation (both text and voice input)
- Uses `canLogWorkout` boolean: `isInTrial || isSubscribed`

### Trial Tracking

- `trial_start_date`: Stored in AsyncStorage and database
- `trialDaysRemaining`: Calculated from start date
- `isInTrial`: Boolean based on days remaining > 0
- RevenueCat CustomerInfo provides server-side validation

## Files Modified

- `package.json` - Added react-native-purchases
- `contexts/subscription-context.tsx` - Trial state management
- `app/(auth)/trial-offer.tsx` - New trial offer screen (NEW)
- `app/(auth)/submit-review.tsx` - Navigate to trial offer
- `app/paywall.tsx` - Updated messaging for trial users
- `app/_layout.tsx` - SubscriptionProvider and Paywall
- `app/(tabs)/create-post.tsx` - Trial/subscription checks for text input
- `app/(tabs)/create-speech.tsx` - Trial/subscription checks for voice input
- `app/(tabs)/index.tsx` - Removed workout counting logic
- `app/settings.tsx` - Trial status display
- `types/database.types.ts` - Added trial date fields
- `supabase/migrations/20251008174826_add_subscription_tracking.sql` - Database schema

## Troubleshooting

### "No subscription packages available"

- Check that your Offering is configured in RevenueCat
- Verify API keys are correct
- Ensure trial product is active in App Store/Play Console
- Check console logs for errors

### Trial doesn't start

- Verify the product includes a free trial period
- Check that product is linked in RevenueCat dashboard
- Ensure user is signed out of production Apple ID (iOS)
- Check sandbox tester account is set up (iOS)

### Trial expires immediately

- Check trial duration is set to 3 days in App Store/Play Console
- Verify local date calculation in `subscription-context.tsx`
- Check device date/time settings

### Subscription status not updating

- Check RevenueCat dashboard for customer info
- Verify network connection
- Check console logs for API errors
- Ensure entitlement identifier is `premium`

### Can't log workouts during trial

- Check `isInTrial` state in subscription context
- Verify trial start date is stored in AsyncStorage
- Check `canLogWorkout` calculation
- Look for console errors during trial activation

## Support

- RevenueCat Docs: https://docs.revenuecat.com/
- Free Trial Setup: https://docs.revenuecat.com/docs/ios-products#free-trials
- RevenueCat Support: https://app.revenuecat.com/settings/support
- React Native Setup: https://docs.revenuecat.com/docs/react-native

## Security Notes

- Never commit API keys to version control
- Use environment variables for production
- Validate purchases server-side using webhooks
- Implement receipt validation for additional security
- Store sensitive data encrypted in production
