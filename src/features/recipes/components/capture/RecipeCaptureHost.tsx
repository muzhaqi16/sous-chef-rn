import React from 'react';
import { useRecipeCapture } from '#features/recipes/hooks/useRecipeCapture';
import type { CaptureSheetName } from '#features/recipes/components/capture/useRecipeCaptureMenu';
import { CapturePollers } from './CapturePollers';
import { CaptureSheet } from './CaptureSheet';
import { PhotoCaptureSheet } from './PhotoCaptureSheet';

interface RecipeCaptureHostProps {
  sheet: CaptureSheetName | null;
  textAllowed: boolean;
  onDismiss: () => void;
}

/** The capture sheets and the polls of the captures they started. */
export const RecipeCaptureHost: React.FC<RecipeCaptureHostProps> = ({
  sheet,
  textAllowed,
  onDismiss,
}) => {
  // Here, inside the navigator: the sheets render outside it, and a capture's
  // outcome toast navigates.
  const capture = useRecipeCapture();

  return (
    <>
      <CapturePollers />
      <CaptureSheet
        visible={sheet === 'link' || sheet === 'text'}
        kind={sheet === 'text' ? 'text' : 'link'}
        textAllowed={textAllowed}
        onSend={capture.start}
        sending={capture.sending}
        onDismiss={onDismiss}
      />
      <PhotoCaptureSheet
        visible={sheet === 'photo'}
        onSend={capture.start}
        sending={capture.sending}
        onDismiss={onDismiss}
      />
    </>
  );
};
