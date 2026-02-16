import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {Icon} from '#utils/iconUtils';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {useStore} from '#store';
import {useAppNavigation} from '#hooks/navigation/useAppNavigation';

interface NotificationBadgeProps {
  size?: number;
  color?: string;
  onPress?: () => void;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  size = 24,
  color,
  onPress,
}) => {
  const {navigateTo} = useAppNavigation();
  const {theme} = useUnistyles();
  const unreadCount = useStore(state => state.unreadCount);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigateTo.notifications();
    }
  };

  return (
    <Pressable style={({pressed}) => [styles.container, pressed && styles.pressed]} onPress={handlePress}>
      <Icon
        name="notifications"
        size={size}
        color={color || theme.colors.textPrimary}
      />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount.toString()}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    position: 'relative',
    padding: theme.spacing.xs,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: theme.colors.error,
    borderRadius: theme.radii.full,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.bold,
  },
  pressed: {
    opacity: 0.7,
  },
}));
