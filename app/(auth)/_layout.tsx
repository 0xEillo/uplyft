import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="rating" />
      <Stack.Screen name="trial-offer" />
      <Stack.Screen name="signup-options" />
    </Stack>
  )
}
