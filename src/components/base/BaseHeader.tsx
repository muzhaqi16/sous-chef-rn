import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, IconName, IconLibrary } from '#utils/iconUtils';

export interface HeaderAction {
  icon: IconName;
  onPress: () => void;
  badge?: number;
  badgeColor?: string;
  size?: number;
  color?: string;
  library?: IconLibrary;
  accessibilityLabel?: string;
}

export interface BaseHeaderProps {
  /** Header title text */
  title?: string | React.ReactNode;

  /** Variant for different header styles */
  variant?: 'default' | 'centered' | 'minimal' | 'transparent';

  /** Show back button on the left */
  showBackButton?: boolean;

  /** Back button handler */
  onBack?: () => void;

  /** Left-side actions (will be after back button if both exist) */
  leftActions?: HeaderAction[];

  /** Right-side actions */
  rightActions?: HeaderAction[];

  /** Custom element to render on the left (overrides back button and leftActions) */
  customLeft?: React.ReactNode;

  /** Custom element to render in the center (overrides title) */
  customCenter?: React.ReactNode;

  /** Custom element to render on the right (overrides rightActions) */
  customRight?: React.ReactNode;

  /** Additional styles for header container */
  style?: StyleProp<ViewStyle>;

  /** Additional styles for title */
  titleStyle?: StyleProp<TextStyle>;

  /** Hide the bottom border */
  hideBorder?: boolean;

  /** Background color override */
  backgroundColor?: string;
}

export const BaseHeader: React.FC<BaseHeaderProps> = ({
  title,
  variant = 'default',
  showBackButton = false,
  onBack,
  leftActions = [],
  rightActions = [],
  customLeft,
  customCenter,
  customRight,
  style,
  titleStyle,
  hideBorder = false,
  backgroundColor,
}) => {
  const { theme } = useUnistyles();

  const renderLeftSection = () => {
    if (customLeft) {
      return <View style={styles.section}>{customLeft}</View>;
    }

    return (
      <View style={styles.section}>
        {(showBackButton || onBack) && (
          <Pressable
            style={({pressed}) => [styles.iconButton, pressed && styles.pressed]}
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Go back"
          >
            <Icon
              name="arrow-back"
              size={theme.sizes.icon.md}
              color={theme.colors.textPrimary}
            />
          </Pressable>
        )}
        {leftActions.map((action, index) => renderAction(action, index))}
      </View>
    );
  };

  const renderCenterSection = () => {
    if (customCenter) {
      return <View style={[styles.titleContainer, styles.centerContent]}>{customCenter}</View>;
    }

    if (!title) {
      return <View style={styles.titleContainer} />;
    }

    const titleElement = typeof title === 'string' ? (
      <Text
        style={[
          styles.title,
          variant === 'centered' && styles.titleCentered,
          titleStyle,
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </Text>
    ) : (
      title
    );

    return <View style={styles.titleContainer}>{titleElement}</View>;
  };

  const renderRightSection = () => {
    if (customRight) {
      return <View style={styles.section}>{customRight}</View>;
    }

    return (
      <View style={styles.section}>
        {rightActions.map((action, index) => renderAction(action, index))}
      </View>
    );
  };

  const renderAction = (action: HeaderAction, index: number) => {
    return (
      <Pressable
        key={index}
        style={({pressed}) => [styles.iconButton, pressed && styles.pressed]}
        onPress={action.onPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={action.accessibilityLabel}
      >
        <Icon
          library={action.library}
          name={action.icon}
          size={action.size || theme.sizes.icon.md}
          color={action.color || theme.colors.textPrimary}
        />
        {action.badge !== undefined && action.badge > 0 && (
          <View
            style={[
              styles.badge,
              action.badgeColor && { backgroundColor: action.badgeColor },
            ]}
          >
            <Text style={styles.badgeText}>
              {action.badge > 99 ? '99+' : action.badge}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.header,
        variant === 'transparent' && styles.headerTransparent,
        hideBorder && styles.headerNoBorder,
        backgroundColor && { backgroundColor },
        style,
      ]}
    >
      {renderLeftSection()}
      {renderCenterSection()}
      {renderRightSection()}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: theme.sizes.touchTarget.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  headerTransparent: {
    backgroundColor: 'transparent',
  },

  headerNoBorder: {
    borderBottomWidth: 0,
  },

  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minWidth: theme.sizes.button.sm,
  },

  titleContainer: {
    flex: 1,
    marginHorizontal: theme.spacing.sm,
    justifyContent: 'center',
  },

  centerContent: {
    alignItems: 'center',
  },

  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },

  titleCentered: {
    textAlign: 'center',
  },

  iconButton: {
    width: theme.sizes.button.sm,
    height: theme.sizes.button.sm,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.error,
    borderRadius: theme.radii['2xl'],
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  badgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.neutral[0],
    textAlign: 'center',
  },

  pressed: {
    opacity: 0.7,
  },
}));

export default BaseHeader;
