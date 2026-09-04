import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '#components/molecules/Button';
import { IconName, Icon } from '#/utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { motion } from '#/theme/foundations/motion';

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
    /** Optional leading icon on the action button (e.g. "add" for a CTA) */
    icon?: IconName;
  };

  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onPress: () => void;
    /** Optional leading icon, mirroring `action`. */
    icon?: IconName;
  };

  /** Icon size */
  iconSize?: number;

  /** Icon color override */
  iconColor?: string;

  /** Icon library (default: uses Icon component default) */
  iconLibrary?: string;

  /** Container alignment */
  alignment?: 'flex-start' | 'center';

  /**
   * `full` fills the screen a list would have occupied; `compact` sits inside
   * a card or a section, with the badge and the vertical rhythm scaled down.
   */
  size?: 'full' | 'compact';

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
  iconSize,
  iconColor,
  iconLibrary,
  alignment = 'center',
  size = 'full',
  style,
  testID,
}) => {
  const glyphSize = iconSize ?? (size === 'compact' ? 32 : 64);
  styles.useVariants({ size });
  // Gentle one-shot entrance so empty states ease in rather than snap. Disabled
  // under the OS "reduce motion" setting. Safe here because empty states mount
  // once when a screen has no content (not recycled list cells), so there's no
  // re-fire-on-scroll risk.
  const containerEntering = FadeIn.duration(motion.timing.MODERATE);
  const badgeEntering = ZoomIn.duration(motion.timing.SLOW);

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
          <Text style={[styles.emoji, { fontSize: glyphSize }]}>{icon}</Text>
        ) : (
          <Icon
            name={icon as IconName}
            size={glyphSize}
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
        role={size === 'compact' ? 'bodyStrong' : 'subheading'}
        align="center"
        tone="primary"
        style={styles.title}
      >
        {title}
      </Text>
      {!!description && (
        <Text align="center" tone="secondary" style={styles.description}>
          {description}
        </Text>
      )}
      {!!hint && (
        <Text role="caption" align="center" tone="tertiary" style={styles.hint}>
          {hint}
        </Text>
      )}
      {!!action && (
        <Button
          onPress={action.onPress}
          variant={action.variant || 'primary'}
          size="medium"
          icon={action.icon}
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
          icon={secondaryAction.icon}
        >
          {secondaryAction.label}
        </Button>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    alignItems: 'center',
    variants: {
      size: {
        full: { flex: 1, paddingHorizontal: theme.spacing['2xl'] },
        compact: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.lg,
        },
      },
    },
  },

  // Soft circular badge behind name/emoji icons — a subtle neutral tint so it
  // reads as a deliberate graphic without competing with the title or actions.
  iconBadge: {
    variants: {
      size: {
        full: { padding: theme.spacing.md },
        compact: { padding: theme.spacing.sm },
      },
    },
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emoji: {
    textAlign: 'center',
  },

  title: {
    variants: {
      size: {
        full: { marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
        compact: {
          marginTop: theme.spacing.sm,
          marginBottom: theme.spacing.xs,
        },
      },
    },
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
