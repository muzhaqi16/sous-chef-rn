import React from 'react';

import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  FadeIn,
  FadeInUp,
  LinearTransition,
} from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
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
      entering={FadeInUp.delay(index * 15).duration(TIMING.FAST)}
      layout={LinearTransition}
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
          size="md"
          weight="semibold"
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
      entering={FadeIn.duration(TIMING.INSTANT)}
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
  container: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
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
    marginLeft: theme.spacing.md,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
