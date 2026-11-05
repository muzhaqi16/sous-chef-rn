import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { Icon, type IconName, type IconLibrary } from '#components/atoms/Icon';

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

/**
 * One choice in an `ActionTray` menu: an icon and its label. RNGH's `Pressable`:
 * on Android the tray's gorhom sheet gestures win a touch from RN's, dropping the
 * press. Themed styles sit on the inner View, which Unistyles keeps bound.
 */
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
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      {({ pressed }) => (
        <View style={[styles.row(destructive), pressed && styles.pressed]}>
          <Icon
            name={icon}
            library={library}
            size={20}
            tone={TONES[look].icon}
          />
          <Text role="bodyStrong" tone={TONES[look].text}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  pressed: {
    opacity: theme.opacity.pressed,
  },
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
