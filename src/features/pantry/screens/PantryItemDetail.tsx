import { pantryTestIDs } from '#features/pantry/testIDs';
import React, { useEffect, useState } from 'react';
import { alertService } from '#services/alertService';
import { PantryItemHeldDetail } from '#features/pantry/components/PantryItemHeldDetail';
import { useDataState } from '#hooks/data/useDataState';
import { useTranslation } from '#i18n';
import { usePantryItemDetailData } from './usePantryItemDetailData';
import { pantryItemHeaderActions } from './pantryItemHeaderActions';
import {
  useSelectedShoppingListId,
  useSelectedPantryId,
} from '#store/useAppStore';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';
import { resolveImageUrl } from '#utils/imageUtils';
import { formatAmountLeft } from '#features/pantry/hooks/usePantryItemTransformation';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { GalleryHero } from '#features/catalog/ui/GalleryHero';
import { CollapsingHeroDetail } from '#components/templates/CollapsingHeroDetail';
import { useReportPhotoHeaderAction } from '#features/catalog/ui/useReportPhotoHeaderAction';
import { entryGallery } from '#features/catalog/ui/entryGallery';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { executeRefreshWithFinally } from '#utils/finallyHelpers';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { usePantryItemDetailActions } from '#features/pantry/hooks/usePantryItemDetailActions';
import { useToday } from '#hooks/app/useToday';
import { useActiveSheet } from '#hooks/ui/useActiveSheet';
import { PantryItemQuantitySection } from '#features/pantry/components/PantryItemQuantitySection';
import { PantryItemInfoSections } from '#features/pantry/components/PantryItemInfoSections';
import { PantryItemRecipesSection } from '#features/pantry/components/PantryItemRecipesSection';
import {
  PantryItemDetailSheets,
  type PantryItemSheet,
} from '#features/pantry/components/PantryItemDetailSheets';

export const PantryItemDetail: React.FC<
  StaticScreenProps<{
    itemId: string;
  }>
> = ({ route }) => {
  const { t } = useTranslation();
  useScreenTransition('PantryItemDetail');
  const itemId = route.params.itemId;
  const {
    goBack,
    toShoppingListMain,
    toPantryItem,
    replaceWithPantryItemDetail,
  } = useAppNavigation();
  const selectedShoppingListId = useSelectedShoppingListId();
  const selectedPantryId = useSelectedPantryId();
  const today = useToday();
  const readingSystem = useReadingSystem();
  const [refreshing, setRefreshing] = useState(false);
  const sheets = useActiveSheet<PantryItemSheet>();

  const data = usePantryItemDetailData(itemId);
  const {
    item,
    listedRow,
    deletedOnServer,
    hiddenFromViewer,
    mergedIntoId,
    itemLoading,
    itemError,
    isUnconfirmed,
    refreshAll,
  } = data;

  // Merged away: the survivor takes this screen's place, so Back still leads
  // where it did.
  useEffect(() => {
    if (mergedIntoId) replaceWithPantryItemDetail({ itemId: mergedIntoId });
  }, [mergedIntoId, replaceWithPantryItemDetail]);

  const handleRefresh = () => {
    void executeRefreshWithFinally(refreshAll, setRefreshing);
  };

  const permissions = usePantryPermissions();

  const actions = usePantryItemDetailActions({
    itemId,
    item,
    selectedPantryId,
    selectedShoppingListId,
    goBack,
    onAddToShoppingListNeedsList: () =>
      alertService.alert(
        t('pantryItemDetail.noShoppingListSelectedTitle'),
        t('pantryItemDetail.noShoppingListSelectedMessage'),
        [
          { text: t('labels.cancel'), style: 'cancel' },
          {
            text: t('pantryItemDetail.goToShoppingLists'),
            onPress: toShoppingListMain,
          },
        ],
      ),
  });

  const handleEdit = () => {
    toPantryItem({ itemId });
  };

  const imageUrl = resolveImageUrl(item, 'large');
  const gallery = entryGallery(item?.image, item?.item.photos);
  const reportPhoto = useReportPhotoHeaderAction(
    item?.item,
    item?.image,
    gallery,
    pantryTestIDs.itemReportPhotoButton,
  );
  const itemPhotos = gallery.photos;
  const showImages =
    itemPhotos.length > 0 || !!imageUrl || !!gallery.leadImageUrl;

  // Classified so an offline cache miss reports itself instead of spinning
  // forever on a bare loader.
  const itemState = useDataState({
    // An unconfirmed create IS a load in progress: the query is skipped and
    // fires the moment the create lands, so the skip must not read as empty.
    loading: itemLoading || isUnconfirmed,
    error: itemError,
    // "Something to show" is the cache entity, not `data`.
    hasResult: !!item,
    isEmpty: !item,
  });

  // The server answered that the stack is gone. That is an answer, not a
  // failed load: it gets its own words and a way back, never "try again".
  if (deletedOnServer) {
    return (
      <CollapsingHeroDetail
        onBack={goBack}
        testID={pantryTestIDs.itemDetail}
        state={{
          value: 'empty',
          onRetry: handleRefresh,
          empty: {
            icon: 'trash-outline',
            title: t('pantryItemDetail.removedTitle'),
            description: t('pantryItemDetail.removedBody'),
            action: { label: t('labels.goBack'), onPress: goBack },
            testID: pantryTestIDs.itemRemoved,
          },
        }}
      >
        {null}
      </CollapsingHeroDetail>
    );
  }

  // A refusal, not a failed load: retrying cannot show it.
  if (hiddenFromViewer) {
    return (
      <CollapsingHeroDetail
        onBack={goBack}
        testID={pantryTestIDs.itemDetail}
        state={{
          value: 'empty',
          onRetry: handleRefresh,
          empty: {
            icon: 'eye-off-outline',
            title: t('pantryItemDetail.hiddenTitle'),
            description: t('pantryItemDetail.hiddenBody'),
            action: { label: t('labels.goBack'), onPress: goBack },
            testID: pantryTestIDs.itemHidden,
          },
        }}
      >
        {null}
      </CollapsingHeroDetail>
    );
  }

  if (!item && itemState === 'offline' && listedRow) {
    return (
      <PantryItemHeldDetail
        item={listedRow}
        onBack={goBack}
        onRetry={handleRefresh}
        onEdit={permissions.canEditItems ? handleEdit : undefined}
      />
    );
  }

  if (!item) {
    return (
      <CollapsingHeroDetail
        onBack={goBack}
        testID={pantryTestIDs.itemDetail}
        state={{ value: itemState, onRetry: handleRefresh }}
      >
        {null}
      </CollapsingHeroDetail>
    );
  }

  const quantityText = formatAmountLeft(item, readingSystem);

  return (
    <>
      <CollapsingHeroDetail
        testID={pantryTestIDs.itemDetail}
        onBack={goBack}
        actions={[
          ...pantryItemHeaderActions({
            item,
            batches: data.batches,
            today,
            permissions,
            actions,
            onEdit: handleEdit,
            openSheet: sheets.open,
            t,
          }),
          ...reportPhoto.actions,
        ]}
        title={item.itemName}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        parallax
        renderHero={
          showImages
            ? heroHeight => (
                <GalleryHero
                  photos={itemPhotos}
                  fallbackImageUrl={imageUrl}
                  leadImageUrl={gallery.leadImageUrl}
                  height={heroHeight}
                  onPhotoPress={index => sheets.open({ type: 'viewer', index })}
                  onPageChange={reportPhoto.onPageChange}
                />
              )
            : undefined
        }
      >
        <PantryItemQuantitySection item={item} quantityText={quantityText} />
        <PantryItemInfoSections
          itemId={itemId}
          item={item}
          quantityText={quantityText}
          data={data}
          actions={actions}
          canEdit={permissions.canEditItems}
        />
        <PantryItemRecipesSection itemName={item.itemName} />
      </CollapsingHeroDetail>

      <PantryItemDetailSheets
        itemId={itemId}
        item={item}
        photos={itemPhotos}
        actions={actions}
        sheets={sheets}
        canEdit={permissions.canEditItems}
        onConflictRefresh={handleRefresh}
      />
    </>
  );
};
