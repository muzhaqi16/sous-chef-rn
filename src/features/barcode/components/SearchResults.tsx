import React, { useState } from 'react';
import { errorService } from '#/services/errorService';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
import { ProductResultCard } from './ProductResultCard';
import { ActionButtons } from './ActionButtons';
import { StyleSheet } from 'react-native-unistyles';
import { useAddScannedItem } from '#features/barcode/hooks/useAddScannedItem';
import { promptPantryDuplicate } from '#domain/pantryItemDuplicate';
import { useAppStore } from '#store/useAppStore';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import type { BarcodeSource, ScannedItem } from '#features/barcode/types';
import { ScrollView } from 'react-native';
import { DataAttributionNotices } from '#components/molecules/DataAttributionNotices';
import {
  ExternalSource,
  NetWeightKind,
  type PackageSizeInput,
} from '#/graphql/generated/schemaTypes';
import { PackSizeSheet, type PackSizeOutcome } from './PackSizeSheet';

export interface SearchResultsProps {
  item: ScannedItem;
  format?: string;
  onScanAnother: () => void;
  onEditItem?: () => void;
  onCreateVariant?: () => void;
  editActionLabel?: string;
  source?: BarcodeSource;
  pantryId?: string;
  shoppingListId?: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  item,
  format,
  onScanAnother,
  onEditItem,
  onCreateVariant,
  editActionLabel,
  source,
  pantryId,
  shoppingListId,
}) => {
  const { t } = useTranslation();
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAskingPackSize, setIsAskingPackSize] = useState(false);
  const setPendingPantryScrollToTop = useAppStore(
    s => s.setPendingPantryScrollToTop,
  );
  const { addToPantry, restockDuplicate, addToShoppingList } =
    useAddScannedItem({ pantryId, shoppingListId });

  const onPantryAdded = () => {
    setIsAdded(true);
    setPendingPantryScrollToTop(true);
    onScanAnother();
  };

  const fromOpenFoodFacts = item.source === ExternalSource.Openfoodfacts;
  // A pantry row needs its pack size; an Open Food Facts record may not state
  // one, and then the user gives it once rather than filling the item form.
  const needsPackSize =
    fromOpenFoodFacts &&
    (item.netWeightKind !== NetWeightKind.Package ||
      item.netWeight === undefined);

  const reportAddFailure = (error: unknown) => {
    errorService.reportError(error, { operation: 'addItemFromSearch' });
    alertService.alert(t('labels.error'), t('errors.addItemFailed'));
  };

  /** Offers to restock the row the pantry already holds, by the size entered. */
  const offerRestock = (
    existingPantryItemId: string,
    packSize?: PackageSizeInput,
  ) => {
    promptPantryDuplicate({
      onRestock: () => {
        void executeWithLoadingState(
          async () => {
            // A refusal RESOLVES; the hook has already said so, and the button
            // must not flip to "Added" over it.
            if (
              !(await restockDuplicate(item, existingPantryItemId, packSize))
            ) {
              return;
            }
            onPantryAdded();
          },
          setIsLoading,
          () => {
            alertService.alert(
              t('labels.error'),
              t('errors.restockFailedRetry'),
            );
          },
        );
      },
    });
  };

  const addItem = () => {
    void executeWithLoadingState(
      async () => {
        if (source === 'pantry' && pantryId) {
          const outcome = await addToPantry(item);

          if (outcome.status === 'duplicate') {
            setIsLoading(false);
            offerRestock(outcome.existingPantryItemId);
            return;
          }

          // The hook has already told the user about a refusal.
          if (outcome.status === 'rejected') return;
          onPantryAdded();
        } else if (source === 'shoppingList' && shoppingListId) {
          if ((await addToShoppingList(item)) === 'reverted') {
            alertService.alert(
              t('labels.error'),
              t('errors.addItemFailedRetry'),
            );
            return;
          }
          setIsAdded(true);
          onScanAnother();
        } else {
          alertService.alert(
            t('labels.error'),
            t('errors.missingRequiredInfo'),
          );
        }
      },
      setIsLoading,
      reportAddFailure,
    );
  };

  const handleAddItem = () => {
    if (!source || isAdded) {
      return;
    }
    if (source === 'pantry' && needsPackSize) {
      setIsAskingPackSize(true);
      return;
    }
    addItem();
  };

  // The sheet stays open until the add lands, is queued, or the duplicate
  // prompt takes over; a refused size is shown on its field.
  const handlePackSize = async (
    packSize: PackageSizeInput,
  ): Promise<PackSizeOutcome> => {
    let outcome;
    try {
      outcome = await addToPantry(item, packSize);
    } catch (error) {
      reportAddFailure(error);
      return { status: 'refused' };
    }

    if (outcome.status === 'duplicate') {
      offerRestock(outcome.existingPantryItemId, packSize);
      return { status: 'done' };
    }
    if (outcome.status === 'rejected') {
      if (outcome.field === 'netWeight') {
        return { status: 'refused', sizeError: outcome.reason };
      }
      alertService.alert(t('labels.error'), outcome.reason);
      return { status: 'refused' };
    }
    onPantryAdded();
    return { status: 'done' };
  };

  // Determine button label based on source and state
  const getButtonLabel = () => {
    if (isAdded) {
      return t('labels.added');
    }

    return source === 'pantry'
      ? t('addItemSheet.addToPantry')
      : t('labels.addToShoppingList');
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
    >
      <ProductResultCard
        item={item}
        format={format}
        onEditItem={onEditItem}
        onCreateVariant={onCreateVariant}
        editActionLabel={editActionLabel}
      />

      <DataAttributionNotices
        attributions={item.dataAttributions ?? []}
        centered
      />

      <ActionButtons
        /*
         * No source means no destination for the item. Only a deep link
         * (`scan/result`) can land here without one, and a button that silently
         * no-ops is worse than none.
         */
        primaryAction={
          source
            ? {
                label: getButtonLabel(),
                onPress: handleAddItem,
                disabled: isAdded,
                loading: isLoading,
              }
            : undefined
        }
        secondaryAction={{
          label: t('labels.scanAnother'),
          onPress: onScanAnother,
        }}
      />

      {/* Mounted only for a product that can ask: its unit field loads the
          unit list, which a catalog product never needs. */}
      {!!needsPackSize && (
        <PackSizeSheet
          visible={isAskingPackSize}
          itemName={item.name}
          onDismiss={() => setIsAskingPackSize(false)}
          onConfirm={handlePackSize}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
}));
