import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  FadeIn,
  FadeInUp,
  LinearTransition,
} from 'react-native-reanimated';
import { Icon } from '#utils/iconUtils';
import type { ActionButtonConfig } from './types';

interface ActionButtonsProps {
  actions: ActionButtonConfig[];
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

const ActionButton: React.FC<{
  action: ActionButtonConfig;
  index: number;
}> = ({ action, index }) => {
  const { theme } = useUnistyles();
  const variant = action.variant || 'secondary';

  return (
    <AnimatedTouchableOpacity
      entering={FadeInUp.delay(index * 15).duration(150)}
      layout={LinearTransition}
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
        color={
          action.color ||
          (variant === 'primary' ? theme.colors.onPrimary : theme.colors.secondary)
        }
        library={action.iconLibrary}
      />
      <Text
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
    </AnimatedTouchableOpacity>
  );
};

export const ActionButtons: React.FC<ActionButtonsProps> = ({ actions }) => {
  if (!actions.length) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(100)}
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
    borderRadius: theme.spacing.md,
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
    opacity: 0.5,
  },
  actionButtonText: {
    marginLeft: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
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
