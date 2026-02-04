import React from 'react';
import { FeatureHintOverlay } from './FeatureHintOverlay';

interface RecipeSaveHintOverlayProps {
  onDismiss: () => void;
}

/**
 * Recipe save hint overlay
 * Shows users how to save recipes for later
 *
 * @example
 * const saveHint = useFeatureHint({
 *   featureId: 'recipe_save',
 *   showOnMount: true,
 *   delay: 1000,
 * });
 *
 * {saveHint.isVisible && (
 *   <RecipeSaveHintOverlay onDismiss={saveHint.dismiss} />
 * )}
 */
export const RecipeSaveHintOverlay: React.FC<RecipeSaveHintOverlayProps> = ({
  onDismiss,
}) => {
  return (
    <FeatureHintOverlay
      config={{
        title: 'Save recipes',
        subtitle: 'Tap the bookmark icon to save recipes for later',
        icon: {
          name: 'bookmark',
          library: 'Ionicons',
          size: 40,
        },
        onDismiss,
      }}
    />
  );
};
