import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { Icon } from '#utils/iconUtils';
import type { ActionTrayContentProps } from './types';
import { Text } from '#components/atoms/Text';

export const ActionTrayContent: React.FC<ActionTrayContentProps> = ({
  children,
  title,
  headerRight,
  showCloseButton = true,
  onClose,
}) => {
  return (
    <Animated.View
      layout={LinearTransition}
      entering={FadeIn.delay(100)}
      exiting={FadeOut}
      style={styles.content}
    >
      {!!(title || showCloseButton) && (
        <View style={styles.header}>
          {title ? (
            <Text size="lg" weight="semibold" tone="primary">
              {title}
            </Text>
          ) : null}
          <View style={styles.fill} />
          {!!headerRight && headerRight}
          {!!showCloseButton && !!onClose && (
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="close" size={16} tone="textSecondary" />
            </Pressable>
          )}
        </View>
      )}
      <Animated.View layout={LinearTransition} style={styles.childrenContainer}>
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
