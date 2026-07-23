# Commitment Hold Pledge

A portable React Native/Expo version of the onboarding "press and hold to commit" interaction.

It includes:

- A 3-second press-and-hold gesture
- Button scale feedback while the user holds
- Rising full-screen fill animation with rotating wave shapes
- Fixed-position reveal text inside the rising fill
- Success checkmark, confetti, and haptic feedback
- Continue CTA after completion
- Configurable copy, colors, duration, icons, and callbacks

## Files

```txt
share/commitment-hold-button/
  src/CommitmentHoldPledge.tsx
  src/index.ts
  demo/CommitmentHoldDemoScreen.tsx
  package.json
  README.md
```

## Dependencies

This assumes an Expo React Native app with:

```sh
npx expo install @expo/vector-icons expo-haptics react-native-safe-area-context
npm install react-native-confetti-cannon
```

If the app already uses Expo and React Native, most of these may already be installed.

## Quick Use

Copy `src/CommitmentHoldPledge.tsx` into your project, for example:

```txt
components/CommitmentHoldPledge.tsx
```

Then render it in an onboarding screen:

```tsx
import { router } from 'expo-router'
import { CommitmentHoldPledge } from '@/components/CommitmentHoldPledge'

export default function CommitmentScreen() {
  return (
    <CommitmentHoldPledge
      name="Alex"
      coachMessage="One small ritual before the plan starts."
      completeCoachMessage="Locked in. Now we can build from here."
      pledgeText="commit to showing up, keeping promises to myself, and making progress one session at a time."
      accentColor="#F97316"
      backgroundColor="#0B0B0D"
      onComplete={() => {
        // Mark this onboarding step complete.
      }}
      onContinue={() => {
        router.push('/next-onboarding-step')
      }}
    />
  )
}
```

## Expo Router Demo

To try the included demo, copy `demo/CommitmentHoldDemoScreen.tsx` into an Expo Router route, such as:

```txt
app/commitment-demo.tsx
```

Update the import if needed:

```tsx
import { CommitmentHoldPledge } from '@/components/CommitmentHoldPledge'
```

Then open `/commitment-demo` in the app.

## Props

Common props:

- `name`: shown in the pledge intro.
- `pledgeText`: main commitment copy.
- `coachMessage`: message before completion.
- `completeCoachMessage`: message after completion.
- `coachImage`: optional image source for the coach/avatar.
- `holdDurationMs`: hold duration. Defaults to `3000`.
- `accentColor`: fill/button color. Defaults to `#F97316`.
- `backgroundColor`, `surfaceColor`, `borderColor`, `textColor`, `mutedTextColor`: theme controls.
- `buttonIcon`, `completeIcon`: Ionicons names.
- `showConfetti`: disable if you do not want the celebration.
- `enableHaptics`: disable for web-only or tests.
- `onHoldingChange`: receives `true` while the user is holding.
- `onComplete`: fires once the hold finishes.
- `onContinue`: fires when the user taps Continue.

## Notes

- The fill animation uses the standard React Native `Animated` API, so it does not require Reanimated.
- The fill progress animates layout color/position with `useNativeDriver: false`; the wave spin and button scale use the native driver.
- The component is intentionally app-agnostic: no Supabase, analytics, theme hooks, router, or app aliases.
- If you do not want confetti, set `showConfetti={false}` and remove `react-native-confetti-cannon`.
