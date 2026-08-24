import React, { useState } from 'react';
import { View } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { alertService } from '#/services/alertService';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTranslation } from '#/i18n';
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { useStorageLocationManagement } from '#hooks/storageLocation/useStorageLocationManagement';
import { StorageLocationCard } from '#components/organisms/storageLocation/StorageLocationCard';
import {
  StorageLocationSheet,
  type StorageLocationInitialData,
} from '#components/modals/StorageLocationSheet/StorageLocationSheet';
import type { StorageLocationFormValues } from '#components/organisms/storageLocation/StorageLocationForm';
import { StorageType } from '#/graphql/generated/schemaTypes';
import type { GetStorageLocationsQuery } from '#operations/storageLocation/storageLocation.generated';
import { useSelectedPantryId } from '#store/useAppStore';
import { commonStyles } from '#/styles/commonStyles';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { EmptyState } from '#components/atoms/EmptyState';

const VIEW_MODES: ('flat' | 'tree')[] = ['flat', 'tree'];

type RouteParams = {
  homeId: string;
};

/** Flat storage-location node from `GetStorageLocations` — the richest shape. */
type FlatStorageLocationNode =
  GetStorageLocationsQuery['storageLocations']['edges'][number]['node'];

/**
 * Superset node the render/edit/delete handlers accept. Both flat list rows and
 * tree nodes are built from the same `GetStorageLocations` node (the tree is
 * derived client-side via `buildTreeFromFlatList`, which adds `childLocations`),
 * so the shared fields are required while the nested `childLocations` is
 * optional. Field types are inherited from the generated node, so spreading into
 * `StorageLocationInitialData` preserves the StorageType/StorageState enums
 * without casts.
 */
type StorageNode = Partial<FlatStorageLocationNode> &
  Pick<FlatStorageLocationNode, 'id' | 'name' | 'type'> & {
    childLocations?: StorageNode[] | null;
  };

export const StorageLocationsScreen: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  useScreenTransition('StorageLocationsScreen');
  const { homeId } = route.params;
  const { goBack } = useAppNavigation();
  const selectedPantryId = useSelectedPantryId();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingLocation, setEditingLocation] =
    useState<StorageLocationInitialData | null>(null);
  const [viewMode, setViewMode] = useState<'flat' | 'tree'>('flat');
  const [refreshing, setRefreshing] = useState(false);

  const {
    locations,
    tree,
    initialLoading,
    creating,
    updating,
    updateLocation,
    deleteLocation,
    setDefaultLocation,
    createLocation,
    error,
    offline,
    refetch,
  } = useStorageLocationManagement(homeId, selectedPantryId ?? undefined);

  // Open sheet for editing — map nested parentLocation to flat parentLocationId.
  const handleOpenEdit = (location: StorageNode) => {
    setEditingLocation({
      ...location,
      parentLocationId: location.parentLocation?.id ?? null,
    });
    setSheetVisible(true);
  };

  // Close sheet
  const handleCloseSheet = () => {
    setSheetVisible(false);
    setEditingLocation(null);
  };

  // Recursive component to render tree structure
  const renderTreeNode = (
    node: StorageNode,
    depth: number = 0,
  ): React.ReactElement | null => {
    if (!node?.id) return null;
    return (
      <View key={node.id} style={{ marginLeft: depth * 16 }}>
        <StorageLocationCard
          location={node}
          isDefault={node.isDefault ?? false}
          onEdit={() => handleOpenEdit(node)}
          onDelete={() => handleDelete(node)}
          onSetDefault={() => handleSetDefault(node.id)}
        />
        {node.childLocations?.map(child => renderTreeNode(child, depth + 1))}
      </View>
    );
  };

  // The sheet's form values carry `type` as a plain string; the mutation
  // inputs expect the `StorageType` enum. The sheet only ever emits valid
  // StorageType values, so narrow it as we hand off to the mutations.
  const handleCreate = async (formData: StorageLocationFormValues) => {
    const result = await createLocation({
      ...formData,
      type: formData.type as StorageType,
    });
    return !!result;
  };

  const handleUpdate = async (
    id: string,
    formData: StorageLocationFormValues,
  ) => {
    const result = await updateLocation(id, {
      ...formData,
      type: formData.type as StorageType,
    });
    return !!result;
  };

  const handleSubmit = async (formData: StorageLocationFormValues) => {
    if (editingLocation) {
      return handleUpdate(editingLocation.id, formData);
    }
    return handleCreate(formData);
  };

  const handleDelete = (location: StorageNode) => {
    // Default location cannot be deleted
    if (location.isDefault) {
      alertService.alert(
        t('storageLocations.cantDeleteDefaultTitle'),
        t('storageLocations.cantDeleteDefaultMessage'),
        [{ text: t('labels.ok') }],
      );
      return;
    }

    // Check for items or child locations
    const childCount = locations.filter(
      loc => loc.parentLocation?.id === location.id,
    ).length;
    const itemCount = location.currentItemCount ?? 0;

    if (itemCount > 0 || childCount > 0) {
      const parts: string[] = [];
      if (itemCount > 0) {
        parts.push(
          t(
            itemCount === 1
              ? 'storageLocations.itemSingular'
              : 'storageLocations.itemPlural',
            { count: itemCount },
          ),
        );
      }
      if (childCount > 0) {
        parts.push(
          t(
            childCount === 1
              ? 'storageLocations.subLocationSingular'
              : 'storageLocations.subLocationPlural',
            { count: childCount },
          ),
        );
      }
      alertService.alert(
        t('storageLocations.cantDeleteTitle'),
        t('storageLocations.cantDeleteWithItems', {
          name: location.name,
          description: parts.join(' & '),
        }),
        [{ text: t('storageLocations.gotIt') }],
      );
      return;
    }

    // Empty, non-default — normal confirmation
    alertService.alert(
      t('storageLocations.deleteTitle'),
      t('labels.areYouSureYouWantToDeleteThisCannotBeUndone', {
        name: location.name,
      }),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteLocation(location.id);
          },
        },
      ],
    );
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultLocation(id);
  };

  const handleRefresh = () => {
    executeRefreshWithFinally(() => refetch(), setRefreshing);
  };

  if (initialLoading) {
    return (
      <DetailTemplate
        title={t('labels.storageLocations')}
        onBack={goBack}
        headerActions={[]}
        sections={[
          {
            content: (
              <View style={commonStyles.loadingContainer}>
                <SousChefLoader
                  size="small"
                  showBrand={false}
                  message={t('storageLocations.loading')}
                />
              </View>
            ),
          },
        ]}
      />
    );
  }

  const isEmpty = locations.length === 0;
  const sections = [
    {
      transparent: true,
      fill: isEmpty,
      content: (
        <>
          {/* Error Message */}
          {!!error && (
            <EmptyState
              icon="alert-circle-outline"
              title={t('errors.boundary.title')}
              description={error.message}
              action={{
                label: t('labels.retry'),
                onPress: handleRefresh,
              }}
            />
          )}

          {/* View Mode Toggle */}
          {locations.length > 0 && (
            <SegmentedControl
              options={VIEW_MODES}
              value={viewMode}
              onChange={setViewMode}
              formatLabel={v =>
                v === 'flat'
                  ? t('storageLocations.listView')
                  : t('storageLocations.treeView')
              }
            />
          )}

          {locations.length === 0 && offline ? (
            // Not "there are none" — we never reached the server and have
            // nothing cached. Offering "Add location" here would invite a
            // duplicate of something that may already exist.
            <EmptyState
              icon="cloud-offline-outline"
              title={t('storageLocations.offlineTitle')}
              description={t('storageLocations.offlineDescription')}
              action={{
                label: t('labels.refresh'),
                onPress: handleRefresh,
                variant: 'outline',
              }}
            />
          ) : locations.length === 0 ? (
            <EmptyState
              icon="server-outline"
              title={t('storageLocations.noLocations')}
              description={t('storageLocations.noLocationsDesc')}
              action={{
                label: t('labels.addLocation'),
                onPress: () => {
                  setEditingLocation(null);
                  setSheetVisible(true);
                },
              }}
            />
          ) : viewMode === 'tree' ? (
            // Tree view: render hierarchical structure
            tree.map(node => renderTreeNode(node, 0))
          ) : (
            // Flat view: render all locations as flat list
            locations.map(location => (
              <StorageLocationCard
                key={location.id}
                location={location}
                isDefault={location.isDefault}
                onEdit={() => handleOpenEdit(location)}
                onDelete={() => handleDelete(location)}
                onSetDefault={() => handleSetDefault(location.id)}
              />
            ))
          )}
        </>
      ),
    },
  ];

  return (
    <>
      <DetailTemplate
        title={t('labels.storageLocations')}
        onBack={goBack}
        headerActions={[
          {
            icon: 'add',
            onPress: () => {
              setEditingLocation(null);
              setSheetVisible(true);
            },
            variant: 'primary',
          },
        ]}
        sections={sections}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
      <StorageLocationSheet
        visible={sheetVisible}
        onClose={handleCloseSheet}
        onSubmit={handleSubmit}
        initialData={editingLocation}
        availableLocations={locations}
        isSubmitting={creating || updating}
      />
    </>
  );
};
