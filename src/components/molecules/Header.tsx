import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon, IconName, IconLibrary } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';

export interface HeaderAction {
  icon: IconName;
  onPress: () => void;
  badge?: number;
  size?: number;
  color?: string;
  library?: IconLibrary;
  testID?: string;
}

interface HeaderProps {
  title: string;
  onBack?: () => void;
  leftActions?: HeaderAction[];
  rightActions?: HeaderAction[];
  centerTitle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  leftActions = [],
  rightActions = [],
  centerTitle = false,
  onBack,
}) => {
  return (
    <View style={commonStyles.header}>
      {/* Left side */}
      <View style={styles.actions}>
        {onBack && (
          <TouchableOpacity style={styles.action} onPress={onBack}>
            <Icon name="arrow-back" size={24} color={styles.title.color} />
          </TouchableOpacity>
        )}
        {leftActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.action}
            onPress={action.onPress}
            testID={action.testID}
          >
            <Icon
              name={action.icon}
              size={action.size || 24}
              color={action.color || styles.title.color}
              library={action.library}
            />
            {action.badge !== undefined && action.badge > 0 && (
              <View style={styles.badge}>
                <Text style={commonStyles.badgeText}>{action.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Title */}
      <Text style={[styles.title, centerTitle && styles.centerTitle]}>
        {title}
      </Text>

      {/* Right side */}
      <View style={styles.actions}>
        {rightActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.action}
            onPress={action.onPress}
            testID={action.testID}
          >
            <Icon
              name={action.icon}
              size={24}
              color={action.color || styles.title.color}
            />
            {action.badge !== undefined && action.badge > 0 && (
              <View style={[commonStyles.badge, styles.badge]}>
                <Text style={commonStyles.badgeText}>{action.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    marginHorizontal: theme.spacing.sm,
  },

  centerTitle: {
    textAlign: 'center',
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },

  action: {
    padding: theme.spacing.xs,
    position: 'relative',
  },

  badge: {
    position: 'absolute',
    top: -theme.spacing.xs,
    right: -theme.spacing.xs,
    backgroundColor: theme.colors.error,
    borderRadius: theme.radii.lg,
    minWidth: theme.spacing['5'],
    height: theme.spacing['5'],
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
