import React from 'react';
import { useTranslation } from '#i18n';
import { BatchStatus } from '#graphql/generated/schemaTypes';
import { DetailSection } from '#components/molecules/DetailSection';
import { currentReading, formatReading } from '#domain/measure';
import { hasNutritionData, toShownNutrition } from '#domain/nutrition';
import { NutritionSummary } from '#features/catalog/ui/NutritionSummary';
import { BatchSection } from '#features/pantry/components/BatchSection';
import { PantryDetailInfo } from '#features/pantry/components/PantryDetailInfo';
import { PantryUsageHistory } from '#features/pantry/components/PantryUsageHistory';
import type { UsePantryItemDetailActionsResult } from '#features/pantry/hooks/usePantryItemDetailActions';
import { formatPackageBreakdownFull } from '#features/pantry/hooks/usePantryItemTransformation';
import type {
  PantryItemDetailData,
  PantryItemDetailItem,
} from '#features/pantry/screens/usePantryItemDetailData';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { formatNetWeightDisplay } from '#utils/formatQuantity';

interface PantryItemInfoSectionsProps {
  itemId: string;
  item: PantryItemDetailItem;
  quantityText: string;
  data: Pick<
    PantryItemDetailData,
    'batches' | 'batchPricing' | 'batchTotalCount'
  >;
  actions: UsePantryItemDetailActionsResult;
  canEdit: boolean;
}

/** Nutrition, the item's details, its batches and how it has been used. */
export const PantryItemInfoSections: React.FC<PantryItemInfoSectionsProps> = ({
  itemId,
  item,
  quantityText,
  data: { batches, batchPricing, batchTotalCount },
  actions,
  canEdit,
}) => {
  const { t } = useTranslation();
  const { toNutritionScreen, toPantryBatchHistory, toPantryUsageHistory } =
    useAppNavigation();
  const readingSystem = useReadingSystem();
  // A use taken from one batch is part of the tracking capability.
  const batchUse = useFeatureFlag('pantryTrackingFoundation');

  const nutrition = toShownNutrition(item.item.shownNutrition);
  const nutritionFacts = nutrition?.facts ?? null;
  // A concept's typical values, titled as such and making no health claim.
  const typicalOf = nutrition?.typicalOf ?? null;

  // Each weight reads in the user's unit system while its Measure still
  // describes the stored figure; after a local edit, as stored until the
  // server answers with new readings.
  const packageSizeReading = currentReading(
    item.packageSize,
    { value: item.netWeight, unitId: item.netWeightUnit?.id },
    readingSystem,
  );
  const netWeightText = packageSizeReading
    ? formatReading(packageSizeReading)
    : formatNetWeightDisplay(item.netWeight, item.netWeightUnit);

  const activeBatches = batches.filter(
    batch => batch.status === BatchStatus.Active,
  );
  const [soleBatch] = activeBatches;
  const soleWeighedBatchId =
    activeBatches.length === 1 && soleBatch?.netWeight != null
      ? soleBatch.id
      : null;

  return (
    <>
      {hasNutritionData(nutritionFacts) && (
        <DetailSection
          title={
            typicalOf
              ? t('labels.typicalFor', { concept: typicalOf })
              : t('pantryItemDetail.nutrition')
          }
        >
          <NutritionSummary
            nutritionFacts={nutritionFacts}
            showHighlights={!typicalOf}
            onPress={() =>
              toNutritionScreen({
                itemId: item.id,
                itemName: item.itemName,
                nutritionFacts,
                typicalOf,
              })
            }
          />
        </DetailSection>
      )}

      <DetailSection dividedRows>
        <PantryDetailInfo
          itemRef={item}
          brandName={item.brand?.name ?? null}
          quantityText={quantityText}
          netWeightText={netWeightText}
          packageBreakdownText={formatPackageBreakdownFull(
            item.packageBreakdown,
            t,
            readingSystem,
          )}
          shelfLifeDays={item.item.shelfLifeDays}
          shelfLifeOpenedDays={item.item.shelfLifeOpenedDays}
          onCorrectPackageSize={
            soleWeighedBatchId && canEdit
              ? () => actions.setCorrectingBatchId(soleWeighedBatchId)
              : undefined
          }
          pricing={batchPricing}
        />
      </DetailSection>

      {batches.length > 1 && (
        <DetailSection flush>
          <BatchSection
            batches={batches}
            totalCount={batchTotalCount}
            onViewAll={() =>
              toPantryBatchHistory({
                pantryItemId: itemId,
                itemName: item.itemName,
              })
            }
            onUse={batchUse && canEdit ? actions.setUsingBatchId : undefined}
            onWaste={actions.setWastingBatchId}
            onCorrectSize={canEdit ? actions.setCorrectingBatchId : undefined}
          />
        </DetailSection>
      )}

      {item.usageRecordsConnection.edges.length > 0 && (
        <PantryUsageHistory
          usageRecords={item.usageRecordsConnection.edges}
          totalCount={item.usageRecordsConnection.totalCount ?? undefined}
          onViewAll={() =>
            toPantryUsageHistory({
              pantryItemId: itemId,
              itemName: item.itemName,
            })
          }
        />
      )}
    </>
  );
};
