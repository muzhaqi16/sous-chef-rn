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
import type { ScannedItem } from '#features/barcode/store/barcodeScannerStore';
import type { BarcodeSource } from '#features/barcode/types';
import { ScrollView } from 'react-native';

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

  const handleAddItem = () => {
    if (!source || isAdded) {
      return;
    }

    void executeWithLoadingState(
      async () => {
        if (source === 'pantry' && pantryId) {
          const outcome = await addToPantry(item);

          if (outcome.status === 'duplicate') {
            setIsLoading(false);
            promptPantryDuplicate({
              onRestock: () => {
                void executeWithLoadingState(
                  async () => {
                    // A refusal RESOLVES; the hook has already said so, and
                    // the button must not flip to "Added" over it.
                    if (
                      !(await restockDuplicate(outcome.existingPantryItemId))
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
      error => {
        errorService.reportError(error, { operation: 'addItemFromSearch' });
        alertService.alert(t('labels.error'), t('errors.addItemFailed'));
      },
    );
  };

  // Determine button label based on source and state
  const getButtonLabel = () => {
    if (isAdded) {
      return t('barcode.added');
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
    </ScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
}));
