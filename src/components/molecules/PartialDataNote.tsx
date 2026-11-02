import React from 'react';
import { useTranslation } from '#/i18n';
import { AlertBanner } from '#components/molecules/AlertBanner';

interface PartialDataNoteProps {
  /** Reads the whole subject again. */
  onRetry: () => void;
  testID?: string;
}

/** Heads a screen showing only what the device holds of its subject. */
export const PartialDataNote: React.FC<PartialDataNoteProps> = ({
  onRetry,
  testID,
}) => {
  const { t } = useTranslation();

  return (
    <AlertBanner
      variant="warning"
      icon="cloud-offline-outline"
      iconLibrary="Ionicons"
      title={t('dataState.partialTitle')}
      subtitle={t('dataState.partialBody')}
      onPress={onRetry}
      showChevron={false}
      testID={testID}
    />
  );
};
