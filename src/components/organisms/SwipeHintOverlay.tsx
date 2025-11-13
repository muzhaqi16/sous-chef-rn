import React from 'react';
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
        title: 'Swipe right to mark as purchased',
        subtitle: 'Try swiping any item to the right',
        animatedElement: <AnimatedSwipeIcon direction="right" />,
        onDismiss,
      }}
    />
  );
};
