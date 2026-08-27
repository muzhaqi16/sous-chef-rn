import React from 'react';
import { useTranslation } from '#/i18n';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { StorageState } from '#/graphql/generated/schemaTypes';

// Selectable storage states. Excludes `StorageState.None`, which has no
// meaningful UI (it previously rendered as a blank fourth segment).
const STORAGE_STATE_OPTIONS: readonly StorageState[] = [
  StorageState.Ambient,
  StorageState.Frozen,
  StorageState.Refrigerated,
];

interface StorageStateControlProps {
  value: StorageState;
  onChange: (state: StorageState) => void;
}

/**
 * Segmented control for picking a {@link StorageState} in
 * {@link MoveToPantryModal}. Delegates to the shared {@link SegmentedControl}
 * so it matches every other segmented control in the app (animated sliding
 * pill, consistent sizing/theming) instead of re-implementing one.
 */
export const StorageStateControl: React.FC<StorageStateControlProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();

  const storageStateLabel: Record<StorageState, string> = {
    [StorageState.Ambient]: t('moveToPantry.stateAmbient'),
    [StorageState.Refrigerated]: t('moveToPantry.stateRefrigerated'),
    [StorageState.Frozen]: t('moveToPantry.stateFrozen'),
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
