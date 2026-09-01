import React from 'react';
import { useTranslation } from '#/i18n';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { StorageState } from '#/graphql/generated/schemaTypes';

// Excludes `StorageState.None`: it has no label, so it renders as a blank segment.
const STORAGE_STATE_OPTIONS: readonly StorageState[] = [
  StorageState.Ambient,
  StorageState.Frozen,
  StorageState.Refrigerated,
];

interface StorageStateControlProps {
  value: StorageState;
  onChange: (state: StorageState) => void;
}

export const StorageStateControl: React.FC<StorageStateControlProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();

  const storageStateLabel: Record<StorageState, string> = {
    [StorageState.Ambient]: t('labels.storageAmbient'),
    [StorageState.Refrigerated]: t('labels.storageRefrigerated'),
    [StorageState.Frozen]: t('labels.storageFrozen'),
    [StorageState.None]: '',
  };

  return (
    <SegmentedControl
      label={t('moveToPantry.storageType')}
      options={STORAGE_STATE_OPTIONS}
      value={value}
      onChange={onChange}
      formatLabel={state => storageStateLabel[state]}
    />
  );
};
