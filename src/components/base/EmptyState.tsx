import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  ZoomIn,
  useReducedMotion,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from './Button';
import { IconName, Icon } from '#/utils/iconUtils';
import { Text } from '#components/atoms/Text';

export interface EmptyStateProps {
  /** Icon to display (can be IconName, emoji string, or React node) */
  icon?: IconName | string | React.ReactNode;

  /** Title text */
  title: string;

  /** Description/subtitle text */
  description?: string;

  /** Optional hint text (smaller, tertiary) */
  hint?: string;

  /** Primary action button */
  action?: {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  };

  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };

  /** Icon size */
  iconSize?: number;

  /** Icon color override */
  iconColor?: string;

  /** Icon library (default: uses Icon component default) */
  iconLibrary?: string;

  /** Container alignment */
  alignment?: 'flex-start' | 'center';

  /** Additional container styles */
  style?: StyleProp<ViewStyle>;

  /** Test ID for E2E testing */
  testID?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  hint,
  action,
  secondaryAction,
  iconSize = 64,
  iconColor,
  iconLibrary,
  alignment = 'center',
  style,
  testID,
}) => {
  // Gentle one-shot entrance so empty states ease in rather than snap. Disabled
  // under the OS "reduce motion" setting. Safe here because empty states mount
  // once when a screen has no content (not recycled list cells), so there's no
  // re-fire-on-scroll risk.
  const reducedMotion = useReducedMotion();
  const containerEntering = reducedMotion ? undefined : FadeIn.duration(280);
  const badgeEntering = reducedMotion ? undefined : ZoomIn.duration(320);

  const renderIcon = () => {
    if (!icon) return null;

    // Custom React node (e.g. a full illustration) renders as-is — it owns its
    // own visual treatment and shouldn't get the badge.
    if (React.isValidElement(icon)) {
      return icon;
    }

    // Check if icon is an emoji (single character or emoji sequence)
    const isEmoji =
      typeof icon === 'string' && icon.length <= 4 && !/^[a-z-]+$/.test(icon);

    // Name/emoji icons sit inside a soft tinted circular badge so the empty
    // state reads as a designed element rather than a lone floating glyph.
    return (
      <Animated.View entering={badgeEntering} style={styles.iconBadge}>
        {isEmoji ? (
          <Text style={[styles.emoji, { fontSize: iconSize }]}>{icon}</Text>
        ) : (
          <Icon
            name={icon as IconName}
            size={iconSize}
            color={iconColor}
            tone="textSecondary"
            library={iconLibrary}
          />
        )}
      </Animated.View>
    );
  };

  return (
    <Animated.View
      entering={containerEntering}
      testID={testID}
      accessibilityRole="summary"
      style={[styles.container, { justifyContent: alignment }, style]}
    >
      {renderIcon()}
      <Text
        size="xl"
        weight="semibold"
        align="center"
        tone="primary"
        style={styles.title}
      >
        {title}
      </Text>
      {!!description && (
        <Text
          size="md"
          align="center"
          tone="secondary"
          style={styles.description}
        >
          {description}
        </Text>
      )}
      {!!hint && (
        <Text size="sm" align="center" tone="tertiary" style={styles.hint}>
          {hint}
        </Text>
      )}
      {!!action && (
        <Button
          onPress={action.onPress}
          variant={action.variant || 'primary'}
          size="medium"
          style={styles.actionButton}
        >
          {action.label}
        </Button>
      )}
      {!!secondaryAction && (
        <Button
          onPress={secondaryAction.onPress}
          variant="outline"
          size="medium"
        >
          {secondaryAction.label}
        </Button>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing['2xl'],
  },

  // Soft circular badge behind name/emoji icons — a subtle neutral tint so it
  // reads as a deliberate graphic without competing with the title or actions.
  iconBadge: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emoji: {
    textAlign: 'center',
  },

  title: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },

  description: {
    marginBottom: theme.spacing.lg,
  },

  hint: {
    marginBottom: theme.spacing.xl,
    fontStyle: 'italic',
  },

  actionButton: {
    marginBottom: theme.spacing.sm,
  },
}));

export default EmptyState;
