import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {useStyles, createStyleSheet} from 'react-native-unistyles';

interface HeaderAction {
  icon: React.ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  badge?: number;
  color?: string;
}

interface HeaderProps {
  title: string;
  onBack?: () => void;
  actions?: HeaderAction[];
  centerTitle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onBack,
  actions = [],
  centerTitle = false,
}) => {
  const {styles, theme} = useStyles(headerStyles);

  return (
    <View style={styles.container}>
      {onBack ? (
        <TouchableOpacity onPress={onBack}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}

      {title && (
        <Text style={[styles.title, centerTitle && styles.centerTitle]}>
          {title}
        </Text>
      )}

      <View style={styles.actions}>
        {actions.map((action, index) => (
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
        {actions.length === 0 && <View style={styles.placeholder} />}
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
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    marginHorizontal: 16,
  },
  centerTitle: {
    textAlign: 'center',
  },
  placeholder: {
    width: 24,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  action: {
    marginLeft: 16,
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
