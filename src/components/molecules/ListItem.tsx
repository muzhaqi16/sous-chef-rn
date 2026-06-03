import React from 'react';
import { View, TextStyle } from 'react-native';
import { ThemedIcon } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#utils/iconUtils';
import { StyleSheet } from 'react-native-unistyles';
import { Badge } from '../base/Badge';
import type { SortableListThemeColors } from '#features/shoppingList/components/SortableShoppingList/SortableListThemeContext';
import { Text } from '#components/atoms/Text';

interface ListItemProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string | React.ReactNode;
  onPress?: () => void;
  leftIcon?: React.ComponentProps<typeof Icon>['name'];
  rightIcon?: React.ComponentProps<typeof Icon>['name'];
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode; // Optional left element for image or icon
  checkboxElement?: React.ReactNode; // Optional checkbox before leftElement (for shopping list)
  dragHandleElement?: React.ReactNode; // Optional drag handle before checkbox (for reordering)
  isPurchased?: boolean; // For strikethrough styling
  // Optional theme override forwarded to `withUnistyles(Icon)` via uniProps;
  // when null, the wrapped Icon falls back to its theme-reactive default.
  themeColors?: SortableListThemeColors | null;
}

const ListItemComponent: React.FC<ListItemProps> = ({
  children,
  title,
  subtitle,
  onPress,
  leftIcon,
  rightIcon = 'chevron-forward',
  badge,
  rightElement,
  leftElement,
  checkboxElement,
  dragHandleElement,
  isPurchased = false,
  themeColors,
}) => {
  const overrideIconColor = themeColors?.textSecondary;

  // Select variants based on purchased state
  styles.useVariants({ purchased: isPurchased });

  // When children are provided, render them directly as content
  if (children) {
    return (
      <View style={styles.container}>
        <View style={styles.contentContainer}>{children}</View>
      </View>
    );
  }

  const content = (
    <>
      {/* Optional checkbox element (for shopping list items) */}
      {!!checkboxElement && (
        <View style={styles.checkboxContainer}>{checkboxElement}</View>
      )}
      {/* Optional left element for image or icon */}
      {leftElement}
      {!!leftIcon && (
        <View style={styles.leftIcon}>
          <ThemedIcon
            name={leftIcon}
            size={24}
            uniProps={t => ({
              color: overrideIconColor ?? t.colors.textSecondary,
            })}
          />
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </Text>
        {!!subtitle &&
          (typeof subtitle === 'string' ? (
            <Text
              style={styles.subtitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          ) : (
            <View style={styles.subtitleContainer}>{subtitle}</View>
          ))}
      </View>
      {!!badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
      {rightElement}
      {!!rightIcon && !rightElement && (
        <ThemedIcon
          name={rightIcon}
          size={24}
          uniProps={t => ({
            color: overrideIconColor ?? t.colors.textSecondary,
          })}
        />
      )}
      {/* Optional drag handle element (for reordering) - on right side */}
      {dragHandleElement}
    </>
  );

  if (onPress) {
    // Build accessible label from content
    const subtitleText = typeof subtitle === 'string' ? subtitle : '';
    const accessibilityLabel = [title, subtitleText, badge?.text]
      .filter(Boolean)
      .join(', ');

    return (
      <View style={styles.container}>
        <AppPressable
          style={styles.contentContainer}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Tap to view details"
          accessibilityState={{ disabled: isPurchased }}
        >
          {content}
        </AppPressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>{content}</View>
    </View>
  );
};

// React Compiler memoizes JSX at the parent call site, so React.memo is
// redundant on non-FlashList components. Per CLAUDE.md / project memory.
export const ListItem = ListItemComponent;

const styles = StyleSheet.create(theme => ({
  container: {
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    // `minHeight` (not a fixed `height`) so single-line rows stay compact but
    // a title that wraps to 2 lines + subtitle can grow instead of being
    // squashed/clipped inside a fixed box. Matches BaseItemCard / MockItemCard;
    // FlashList v2 handles variable row heights natively.
    minHeight: theme.sizes.itemCard.compact.height,
    gap: theme.spacing.sm, // Better spacing between elements
  },
  checkboxContainer: {
    marginRight: theme.spacing.xs, // Reduced since gap provides base spacing
    justifyContent: 'center',
    flexShrink: 0, // Prevent checkbox from being compressed when no image exists
  },
  leftIcon: {
    marginRight: theme.spacing['3'],
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    variants: {
      purchased: {
        true: {
          textDecorationLine: 'line-through' as TextStyle['textDecorationLine'],
          opacity: theme.opacity.disabled,
          color: theme.colors.textSecondary,
        },
      },
    },
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    variants: {
      purchased: {
        true: {
          textDecorationLine: 'line-through' as TextStyle['textDecorationLine'],
          opacity: theme.opacity.disabled,
        },
      },
    },
  },
  subtitleContainer: {
    marginTop: theme.spacing.xs,
    variants: {
      purchased: {
        true: {
          opacity: theme.opacity.disabled,
        },
      },
    },
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
