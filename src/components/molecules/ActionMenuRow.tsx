import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { Icon, type IconName, type IconLibrary } from '#utils/iconUtils';

type RowLook = 'plain' | 'destructive' | 'disabled';

const TONES: Record<
  RowLook,
  {
    icon: React.ComponentProps<typeof Icon>['tone'];
    text: React.ComponentProps<typeof Text>['tone'];
  }
> = {
  plain: { icon: 'textPrimary', text: undefined },
  destructive: { icon: 'error', text: 'danger' },
  disabled: { icon: 'textTertiary', text: 'tertiary' },
};

interface ActionMenuRowProps {
  icon: IconName;
  library?: IconLibrary;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}

/** One choice in an `ActionTray` menu: an icon and its label. */
export const ActionMenuRow: React.FC<ActionMenuRowProps> = ({
  icon,
  library,
  label,
  onPress,
  destructive = false,
  disabled = false,
  testID,
}) => {
  let look: RowLook = destructive ? 'destructive' : 'plain';
  if (disabled) look = 'disabled';
  return (
    <AppPressable
      style={styles.row(destructive)}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <Icon name={icon} library={library} size={20} tone={TONES[look].icon} />
      <Text role="bodyStrong" tone={TONES[look].text}>
        {label}
      </Text>
    </AppPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  row: (destructive: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: destructive ? theme.colors.error : theme.colors.border,
    backgroundColor: 'transparent',
  }),
}));
