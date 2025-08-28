import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {StyleSheet, mq, Display, Hide} from 'react-native-unistyles';
import {Icon, IconName, IconLibrary} from '#utils/iconUtils';

export interface HeaderAction {
  icon: IconName;
  onPress: () => void;
  badge?: number;
  size?: number;
  color?: string;
  library?: IconLibrary;
}

interface HeaderProps {
  title: string;
  onBack?: () => void;
  leftActions?: HeaderAction[];
  rightActions?: HeaderAction[];
  centerTitle?: boolean;
}

const headerStyles = StyleSheet.create((theme, rt) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    paddingVertical: theme.spacing.sm,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,

    // Add safe area padding on tablets/desktop
    ...{
      ':w[md]': {
        paddingTop: rt.insets.top + theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
      },
      ':w[lg]': {
        paddingHorizontal: theme.spacing.xl,
      },
    },
  },

  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    marginHorizontal: 8,

    // Larger title on bigger screens
    ...{
      ':w[md]': {
        fontSize: 18,
      },
      ':w[lg]': {
        fontSize: 20,
      },
    },
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
    top: -4,
    right: -4,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
}));

export const Header: React.FC<HeaderProps> = ({
  title,
  leftActions = [],
  rightActions = [],
  centerTitle = false,
  onBack,
}) => {
  return (
    <View style={headerStyles.container}>
      {/* Left side */}
      <View style={headerStyles.actions}>
        {onBack && (
          <TouchableOpacity style={headerStyles.action} onPress={onBack}>
            <Icon
              name="arrow-back"
              size={24}
              color={headerStyles.title.color}
            />
          </TouchableOpacity>
        )}
        {leftActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={headerStyles.action}
            onPress={action.onPress}>
            <Icon
              name={action.icon}
              size={action.size || 24}
              color={action.color || headerStyles.title.color}
              library={action.library}
            />
            {action.badge !== undefined && action.badge > 0 && (
              <View style={headerStyles.badge}>
                <Text style={headerStyles.badgeText}>{action.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Title */}
      <Text
        style={[headerStyles.title, centerTitle && headerStyles.centerTitle]}>
        {title}
      </Text>

      {/* Right side */}
      <View style={headerStyles.actions}>
        {rightActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={headerStyles.action}
            onPress={action.onPress}>
            <Icon
              name={action.icon}
              size={24}
              color={action.color || headerStyles.title.color}
            />
            {action.badge !== undefined && action.badge > 0 && (
              <View style={headerStyles.badge}>
                <Text style={headerStyles.badgeText}>{action.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
