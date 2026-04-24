import { useThemedColors } from '@/hooks/useThemedColors'
import { Switch } from 'react-native'
import { SettingsRow, type SettingsRowProps } from './settings-row'

type InheritedRowProps = Omit<
  SettingsRowProps,
  'onPress' | 'rightContent' | 'hideChevron' | 'destructive' | 'touchableProps'
>

interface SettingsSwitchRowProps extends InheritedRowProps {
  value: boolean
  onValueChange: (value: boolean) => void
  /**
   * Additional condition that disables the switch in-place
   * (on top of the row's base `disabled` prop).
   */
  switchDisabled?: boolean
}

/**
 * Convenience wrapper around <SettingsRow> for the extremely common
 * "row with a toggle on the right" pattern. Uses `colors.switchTrackOff` /
 * `switchThumbOff` so dark mode doesn't look broken.
 */
export function SettingsSwitchRow({
  value,
  onValueChange,
  switchDisabled,
  disabled,
  ...rowProps
}: SettingsSwitchRowProps) {
  const colors = useThemedColors()

  return (
    <SettingsRow
      {...rowProps}
      disabled={disabled}
      rightContent={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled || switchDisabled}
          trackColor={{
            false: colors.switchTrackOff,
            true: colors.brandPrimarySoft,
          }}
          thumbColor={value ? colors.brandPrimary : colors.switchThumbOff}
        />
      }
    />
  )
}
