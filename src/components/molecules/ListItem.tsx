import React from 'react';
import { View, Text, TouchableOpacity, TextStyle } from 'react-native';
import { Icon } from '#utils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Badge } from '../base/Badge';
import type { SortableListThemeColors } from '#/components/organisms/SortableShoppingList/SortableListThemeContext';

interface ListItemProps {
  title: string;
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
  // PERFORMANCE: Optional theme colors passed from parent to avoid useUnistyles call
  themeColors?: SortableListThemeColors | null;
}

const ListItemComponent: React.FC<ListItemProps> = ({
  title,
  subtitle,
  onPress,
  leftIcon,
  rightIcon = 'chevron-right',
  badge,
  rightElement,
  leftElement,
  checkboxElement,
  dragHandleElement,
  isPurchased = false,
  themeColors,
}) => {
  // PERFORMANCE: Only call useUnistyles if themeColors not provided
  // When used in shopping list, parent provides colors to avoid repeated hook calls
  const { theme } = useUnistyles();
  const iconColor = themeColors?.textSecondary ?? theme.colors.textSecondary;

  // Select variants based on purchased state
  styles.useVariants({ purchased: isPurchased });

  const content = (
    <>
      {/* Optional checkbox element (for shopping list items) */}
      {checkboxElement && (
        <View style={styles.checkboxContainer}>{checkboxElement}</View>
      )}
      {/* Optional left element for image or icon */}
      {leftElement}
      {leftIcon && (
        <View style={styles.leftIcon}>
          <Icon name={leftIcon} size={24} color={iconColor} />
        </View>
      )}
      <View style={styles.content}>
        <Text
          style={styles.title}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {subtitle && (
          typeof subtitle === 'string' ? (
            <Text
              style={styles.subtitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          ) : (
            <View style={styles.subtitleContainer}>
              {subtitle}
            </View>
          )
        )}
      </View>
      {badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
      {rightElement}
      {rightIcon && !rightElement && (
        <Icon name={rightIcon} size={24} color={iconColor} />
      )}
      {/* Optional drag handle element (for reordering) - on right side */}
      {dragHandleElement}
    </>
  );

  if (onPress) {
    // Build accessible label from content
    const subtitleText = typeof subtitle === 'string' ? subtitle : '';
    const accessibilityLabel = [title, subtitleText, badge?.text].filter(Boolean).join(', ');

    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.contentContainer}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Tap to view details"
          accessibilityState={{ disabled: isPurchased }}
        >
          {content}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>{content}</View>
    </View>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const ListItem = React.memo(ListItemComponent);

const styles = StyleSheet.create(theme => ({
  container: {
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    height: 87, // Fixed height for drag-to-reorder calculations
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
    fontWeight: '500',
    color: theme.colors.textPrimary,
    variants: {
      purchased: {
        true: {
          textDecorationLine: 'line-through' as TextStyle['textDecorationLine'],
          opacity: 0.6,
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
          opacity: 0.6,
        },
      },
    },
  },
  subtitleContainer: {
    marginTop: theme.spacing.xs,
    variants: {
      purchased: {
        true: {
          opacity: 0.6,
        },
      },
    },
  },
}));
