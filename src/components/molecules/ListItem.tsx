import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '#utils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Badge } from '../base/Badge';

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
}

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  onPress,
  leftIcon,
  rightIcon = 'chevron-right',
  badge,
  rightElement,
  leftElement,
}) => {
  const { theme } = useUnistyles();

  const content = (
    <>
      {/* Optional left element for image or icon */}
      {leftElement}
      {leftIcon && (
        <View style={styles.leftIcon}>
          <Icon name={leftIcon} size={24} color={theme.colors.textSecondary} />
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </Text>
        {subtitle && (
          typeof subtitle === 'string' ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : (
            <View style={styles.subtitleContainer}>{subtitle}</View>
          )
        )}
      </View>
      {badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
      {rightElement}
      {rightIcon && !rightElement && (
        <Icon name={rightIcon} size={24} color={theme.colors.textSecondary} />
      )}
    </>
  );

  if (onPress) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.contentContainer} onPress={onPress}>
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

const styles = StyleSheet.create(theme => ({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 87,
  },
  leftIcon: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  subtitleContainer: {
    marginTop: 4,
  },
}));
