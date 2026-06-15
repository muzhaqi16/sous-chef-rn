import React from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
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
    // No `flex: 1` on these wrappers: the content must size to its natural
    // height so the sheet's dynamic sizing can measure it (`flex: 1` collapses
    // to 0 inside the tray's `BottomSheetScrollView` content container).
    <Animated.View
      layout={LinearTransition}
      entering={FadeIn.delay(100)}
      exiting={FadeOut}
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
            <AppPressable onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={16} tone="textSecondary" />
            </AppPressable>
          )}
        </View>
      )}
      <Animated.View layout={LinearTransition}>{children}</Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
