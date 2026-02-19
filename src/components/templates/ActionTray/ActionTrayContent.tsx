import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { Icon } from '#utils/iconUtils';
import type { ActionTrayContentProps } from './types';

export const ActionTrayContent: React.FC<ActionTrayContentProps> = ({
  children,
  title,
  showCloseButton = true,
  onClose,
}) => {
  const { theme } = useUnistyles();

  return (
    <Animated.View
      layout={LinearTransition}
      entering={FadeIn.delay(100)}
      exiting={FadeOut}
      style={styles.content}
    >
      {(title || showCloseButton) && (
        <View style={styles.header}>
          {title && <Text style={styles.title}>{title}</Text>}
          <View style={styles.fill} />
          {showCloseButton && onClose && (
            <Pressable onPress={onClose} style={({pressed}) => [styles.closeButton, pressed && styles.pressed]}>
              <Icon name="close" size={16} color={theme.colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}
      <Animated.View
        layout={LinearTransition}
        style={styles.childrenContainer}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  fill: {
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childrenContainer: {
    flex: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));