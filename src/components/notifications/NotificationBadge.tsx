import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {useStore} from '#store';
import {useNavigation} from '@react-navigation/native';
import {RootNavProp} from '#navigation';

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
  const navigation = useNavigation<RootNavProp>();
  const {theme} = useUnistyles();
  const unreadCount = useStore(state => state.unreadCount);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('NotificationStack', {screen: 'NotificationList'});
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
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
    </TouchableOpacity>
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
    backgroundColor: theme.colors.error || '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
}));
