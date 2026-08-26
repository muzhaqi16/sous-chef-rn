import React from 'react';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { PressableScale } from '#components/atoms/PressableScale';
import type { AddButtonProps } from './types';

export const AddButton: React.FC<AddButtonProps> = ({
  onPress,
  icon = 'add',
  iconLibrary,
  disabled = false,
}) => {
  // 'use no memo' — REQUIRED, not a preference. `styles.useVariants(...)` is
  // rewritten by the Unistyles babel plugin into a rebound `styles` local, but
  // that happens AFTER the React Compiler has already picked its cache keys
  // (babel.config.js runs the compiler first, deliberately). The compiler sees
  // `styles` as a stable module global, so it caches the resolved variant style
  // on the wrong dependencies and the variant freezes at its first-render
  // value — a button that mounts disabled stays looking disabled after the
  // prop clears. Verified against the installed babel-plugin-react-compiler +
  // react-native-unistyles@3.3.0 by
  // `node scripts/check-unistyles-variant-staleness.mjs --explain`.
  'use no memo';

  const { t } = useTranslation();
  styles.useVariants({ disabled });

  return (
    <PressableScale
      testID="tab-bar-add-button"
      onPress={onPress}
      activeScale={0.9}
      haptic="medium"
      style={styles.addButton}
      accessibilityRole="button"
      accessibilityLabel={t('tabBar.actionButton')}
      accessibilityHint={t('tabBar.actionButtonHint')}
      accessibilityState={{ disabled }}
      disabled={disabled}
    >
      <Icon name={icon} size={28} tone="white" library={iconLibrary} />
    </PressableScale>
  );
};

const styles = StyleSheet.create(theme => ({
  addButton: {
    width: theme.sizes.fab.md,
    height: theme.sizes.button.md,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    // Primary CTA — follows the user's selected App Color so the + button
    // matches the active tab icon highlight and other primary-tinted surfaces.
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for elevated effect
    boxShadow: [
      {
        offsetX: 0,
        offsetY: theme.spacing.xs,
        blurRadius: theme.radii.md,
        spreadDistance: 0,
        color: `${theme.colors.primary}4D`,
      },
    ],
    variants: {
      disabled: {
        true: {
          opacity: 0.4,
          boxShadow: [],
        },
      },
    },
  },
}));
