import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { DetailTitleRow } from '#components/atoms/DetailTitleRow';
import { InfoRow } from '#components/atoms/InfoRow';
import { Text } from '#components/atoms/Text';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { PartialDataNote } from '#components/molecules/PartialDataNote';
import { CollapsingHeroDetail } from '#components/templates/CollapsingHeroDetail';
import { useToday } from '#hooks/app/useToday';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import type { PantryItem_ListedFragment } from '#features/pantry/cache/pantryItemListed.generated';
import {
  formatHeldAmount,
  formatStorageState,
  getExpiryInfo,
} from '#features/pantry/hooks/usePantryItemTransformation';
import { pantryTestIDs } from '#features/pantry/testIDs';

interface PantryItemHeldDetailProps {
  item: PantryItem_ListedFragment;
  onBack: () => void;
  onRetry: () => void;
  /** Absent for someone who may not edit the pantry. */
  onEdit?: () => void;
}

/** A stack never opened on this device, offline: what its list row holds. */
export const PantryItemHeldDetail: React.FC<PantryItemHeldDetailProps> = ({
  item,
  onBack,
  onRetry,
  onEdit,
}) => {
  const { t } = useTranslation();
  const today = useToday();
  const readingSystem = useReadingSystem();

  const location =
    item.storageLocation?.name ?? formatStorageState(item.storageState, t);
  const actions: HeaderAction[] = onEdit
    ? [
        {
          icon: 'create-outline',
          accessibilityLabel: t('labels.edit'),
          onPress: onEdit,
          testID: pantryTestIDs.itemEditButton,
        },
      ]
    : [];

  return (
    <CollapsingHeroDetail
      testID={pantryTestIDs.itemDetail}
      onBack={onBack}
      actions={actions}
      title={item.itemName}
    >
      <DetailTitleRow
        title={item.itemName}
        numberOfLines={2}
        trailing={
          <Text role="heading" style={styles.amount}>
            {formatHeldAmount(item, readingSystem)}
          </Text>
        }
      />
      <View style={styles.content}>
        <PartialDataNote onRetry={onRetry} testID={pantryTestIDs.itemPartial} />
        {location ? (
          <InfoRow
            label={t('labels.storage')}
            value={location}
            icon="cube-outline"
            showColon={false}
            labelTone="secondary"
            valueTone="primary"
          />
        ) : null}
        <InfoRow
          label={t('pantryItemDetail.expiring')}
          value={
            getExpiryInfo(item.expiresOn, today, t)?.text ??
            t('pantryItemDetail.noExpiry')
          }
          icon="time-outline"
          showColon={false}
          labelTone="secondary"
          valueTone="primary"
        />
      </View>
    </CollapsingHeroDetail>
  );
};

const styles = StyleSheet.create(theme => ({
  amount: {
    color: theme.colors.primary,
  },
  content: {
    gap: theme.spacing.md,
  },
}));
