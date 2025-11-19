import { Stack } from 'expo-router'

export default function BodyLogLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'transparentModal',
        animation: 'none',
      }}
    />
  )
}
