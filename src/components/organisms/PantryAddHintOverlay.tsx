import React from 'react';
import { FeatureHintOverlay } from './FeatureHintOverlay';

interface PantryAddHintOverlayProps {
  onDismiss: () => void;
}

/**
 * Pantry add button hint overlay
 * Shows users how to add items to their pantry
 *
 * @example
 * const pantryHint = useFeatureHint({
 *   featureId: 'pantry_add_button',
 *   showOnMount: true,
 *   delay: 1000,
 * });
 *
 * {pantryHint.isVisible && (
 *   <PantryAddHintOverlay onDismiss={pantryHint.dismiss} />
 * )}
 */
export const PantryAddHintOverlay: React.FC<PantryAddHintOverlayProps> = ({
  onDismiss,
}) => {
  return (
    <FeatureHintOverlay
      config={{
        title: 'Add to pantry',
        subtitle: 'Tap the + button to add items to your pantry',
        icon: {
          name: 'add-circle',
          library: 'Ionicons',
          size: 40,
        },
        onDismiss,
      }}
    />
  );
};
