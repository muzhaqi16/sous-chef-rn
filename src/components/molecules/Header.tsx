import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {Icon, IconName, IconLibrary} from '#utils/iconUtils';
import {useStyles, createStyleSheet} from 'react-native-unistyles';

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

export const Header: React.FC<HeaderProps> = ({
  title,
  leftActions = [],
  rightActions = [],
  centerTitle = false,
}) => {
  const {styles, theme} = useStyles(headerStyles);

  return (
    <View style={styles.container}>
      <View style={styles.leftActions}>
        {leftActions.map((action, index) => (
          <TouchableOpacity key={index} onPress={action.onPress}>
            <Icon
              name={action.icon}
              size={action.size || 24}
              color={action.color || theme.colors.textPrimary}
              library={action.library}
            />
            {action.badge !== undefined && action.badge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{action.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        {leftActions.length === 0 && <View style={styles.placeholder} />}
      </View>

      {title && (
        <Text style={[styles.title, centerTitle && styles.centerTitle]}>
          {title}
        </Text>
      )}

      <View style={styles.actions}>
        {rightActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.action}
            onPress={action.onPress}>
            <Icon
              name={action.icon}
              size={24}
              color={action.color || theme.colors.textPrimary}
            />
            {action.badge !== undefined && action.badge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{action.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        {rightActions.length === 0 && <View style={styles.placeholder} />}
      </View>
    </View>
  );
};

const headerStyles = createStyleSheet(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    marginHorizontal: 8,
  },
  centerTitle: {
    textAlign: 'center',
  },
  placeholder: {
    paddingRight: theme.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  action: {
    marginLeft: 16,
    position: 'relative',
  },
  leftActions: {
    margin: 0,
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
