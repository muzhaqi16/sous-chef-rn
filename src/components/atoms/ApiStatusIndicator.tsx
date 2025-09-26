import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils';
import { useApiStatus } from '#/hooks/useApiStatus';

interface ApiStatusIndicatorProps {
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
}

export const ApiStatusIndicator: React.FC<ApiStatusIndicatorProps> = ({
  showText = false,
  size = 'small',
  onPress,
}) => {
  const { isConnected, status, statusMessage, resetConnection } = useApiStatus();

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#22C55E'; // Green
      case 'disconnected':
        return '#EF4444'; // Red
      case 'testing':
      case 'recovering':
        return '#F59E0B'; // Orange
      default:
        return '#6B7280'; // Gray
    }
  };

  const getIconName = () => {
    switch (status) {
      case 'connected':
        return 'wifi';
      case 'disconnected':
        return 'wifi-off';
      case 'testing':
      case 'recovering':
        return 'refresh';
      default:
        return 'alert-circle';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'medium':
        return 20;
      case 'large':
        return 24;
      default:
        return 16;
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (status === 'disconnected') {
      resetConnection();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        size === 'large' && styles.containerLarge,
        !isConnected && styles.containerDisconnected,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Icon
          name={getIconName()}
          size={getIconSize()}
          color={getStatusColor()}
        />

        {showText && (
          <Text style={[styles.text, { color: getStatusColor() }]}>
            {statusMessage}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.spacing.xs,
    backgroundColor: 'transparent',
  },
  containerLarge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  containerDisconnected: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#EF444420',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  text: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '500',
  },
}));