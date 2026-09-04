import React from 'react';

import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  FadeIn,
  FadeInUp,
  LinearTransition,
} from 'react-native-reanimated';
import { motion } from '#/theme/foundations/motion';
import { Icon } from '#utils/iconUtils';
import type { ActionButtonConfig } from './types';
import { Text } from '#components/atoms/Text';

interface ActionButtonsProps {
  actions: ActionButtonConfig[];
}

const ActionButton: React.FC<{
  action: ActionButtonConfig;
  index: number;
}> = ({ action, index }) => {
  const variant = action.variant || 'secondary';

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 15).duration(motion.timing.FAST)}
      layout={LinearTransition}
      style={styles.buttonWrapper}
    >
      <AppPressable
        style={[
          styles.actionButton,
          variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
          action.disabled && styles.disabledButton,
        ]}
        onPress={action.onPress}
        disabled={action.disabled}
      >
        <Icon
          name={action.icon}
          size={20}
          color={action.color}
          tone={variant === 'primary' ? 'onPrimary' : 'secondary'}
          library={action.iconLibrary}
        />
        <Text
          role="label"
          align="center"
          numberOfLines={1}
          style={[
            styles.actionButtonText,
            variant === 'primary'
              ? styles.primaryButtonText
              : styles.secondaryButtonText,
            action.disabled && styles.disabledButtonText,
          ]}
        >
          {action.label}
        </Text>
      </AppPressable>
    </Animated.View>
  );
};

export const ActionButtons: React.FC<ActionButtonsProps> = ({ actions }) => {
  if (!actions.length) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(motion.timing.INSTANT)}
      layout={LinearTransition}
      style={styles.container}
    >
      {actions.map((action, index) => (
        <ActionButton
          key={`${action.icon}-${action.label}`}
          action={action}
          index={index}
        />
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  // Horizontal grid: each button flexes to share the row equally (3-up for the
  // common case, 2-up for two actions, full width for one) and wraps if the
  // labels can't fit, so longer translations stay readable.
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  buttonWrapper: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 88,
  },
  actionButton: {
    // flex:1 so every chip fills its (row-stretched) wrapper height — keeps
    // chips equal height when one label wraps to two lines.
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  disabledButton: {
    opacity: theme.opacity.disabled,
  },
  actionButtonText: {
    marginTop: 2,
  },
  primaryButtonText: {
    color: theme.colors.background,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
  },
  disabledButtonText: {
    color: theme.colors.textSecondary,
  },
}));
