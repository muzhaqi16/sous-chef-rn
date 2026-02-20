import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FeatureHintOverlay } from './FeatureHintOverlay';
import { AnimatedSwipeIcon } from '../atoms/AnimatedSwipeIcon';

interface SwipeHintOverlayProps {
  onDismiss: () => void;
}

/**
 * Shopping list swipe hint overlay - uses reusable components
 * Combine with useFeatureHint hook for full functionality
 *
 * @example
 * const swipeHint = useFeatureHint({
 *   featureId: 'shopping_list_swipe',
 *   showOnMount: true,
 *   delay: 1000,
 * });
 *
 * {swipeHint.isVisible && (
 *   <SwipeHintOverlay onDismiss={swipeHint.dismiss} />
 * )}
 */
export const SwipeHintOverlay: React.FC<SwipeHintOverlayProps> = ({
  onDismiss,
}) => {
  return (
    <FeatureHintOverlay
      config={{
        title: 'Swipe actions',
        subtitle: 'Swipe items to quickly edit or delete them',
        animatedElement: <DualSwipeHint />,
        onDismiss,
      }}
    />
  );
};

const DualSwipeHint: React.FC = () => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.dualContainer}>
      <View style={styles.swipeAction}>
        <AnimatedSwipeIcon
          direction="left"
          icon="create-outline"
          delay={500}
        />
        <Text style={[styles.actionLabel, { color: theme.colors.textSecondary }]}>
          Edit
        </Text>
      </View>
      <View style={styles.swipeAction}>
        <AnimatedSwipeIcon
          direction="right"
          icon="trash-outline"
          delay={500}
        />
        <Text style={[styles.actionLabel, { color: theme.colors.textSecondary }]}>
          Delete
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  dualContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  swipeAction: {
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    marginTop: theme.spacing.xs,
  },
}));
