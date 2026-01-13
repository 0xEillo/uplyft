import { haptic } from '@/lib/haptics';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        // Add a soft haptic feedback when pressing down on the tabs.
        haptic('light');
        props.onPressIn?.(ev);
      }}
    />
  );
}
