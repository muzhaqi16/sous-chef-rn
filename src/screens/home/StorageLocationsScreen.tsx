import React, { useState } from 'react';
import { View } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { alertService } from '#/services/alertService';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTranslation } from 'react-i18next';
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { useStorageLocationManagement } from '#hooks/storageLocation/useStorageLocationManagement';
import { StorageLocationCard } from '#components/organisms/storageLocation/StorageLocationCard';
import { StorageLocationSheet } from '#components/modals/StorageLocationSheet/StorageLocationSheet';
import { useSelectedPantryId } from '#store/useAppStore';
import { commonStyles } from '#/styles/commonStyles';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { executeRefreshWithFinally } from '#/utils/compilerSafeWrappers';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { EmptyState } from '#components/base/EmptyState';

const VIEW_MODES: ('flat' | 'tree')[] = ['flat', 'tree'];

type RouteParams = {
  homeId: string;
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
  const [editingLocation, setEditingLocation] = useState<any>(null);
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
    refetch,
  } = useStorageLocationManagement(homeId, selectedPantryId ?? undefined);

  // Open sheet for editing — map nested parentLocation to flat parentLocationId
  const handleOpenEdit = (location: any) => {
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
    node: any,
    depth: number = 0,
  ): React.ReactElement | null => {
    if (!node?.id) return null;
    return (
      <View key={node.id} style={{ marginLeft: depth * 16 }}>
        <StorageLocationCard
          location={node}
          isDefault={node.isDefault}
          onEdit={() => handleOpenEdit(node)}
          onDelete={() => handleDelete(node)}
          onSetDefault={() => handleSetDefault(node.id)}
        />
        {node.childLocations?.map((child: any) =>
          renderTreeNode(child, depth + 1),
        )}
      </View>
    );
  };

  const handleCreate = async (formData: any) => {
    const result = await createLocation(formData);
    return !!result;
  };

  const handleUpdate = async (id: string, formData: any) => {
    const result = await updateLocation(id, formData);
    return !!result;
  };

  const handleSubmit = async (formData: any) => {
    if (editingLocation) {
      return handleUpdate(editingLocation.id, formData);
    }
    return handleCreate(formData);
  };

  const handleDelete = (location: any) => {
    // Default location cannot be deleted
    if (location.isDefault) {
      alertService.alert(
        t('storageLocations.cantDeleteDefaultTitle'),
        t('storageLocations.cantDeleteDefaultMessage'),
        [{ text: t('storageLocations.ok') }],
      );
      return;
    }

    // Check for items or child locations
    const childCount = locations.filter(
      (loc: any) => loc.parentLocation?.id === location.id,
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
      t('storageLocations.deleteConfirm', { name: location.name }),
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
        title={t('storageLocations.title')}
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
              title={t('storageLocations.somethingWrong')}
              description={error.message}
              action={{
                label: t('storageLocations.retry'),
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

          {locations.length === 0 ? (
            <EmptyState
              icon="server-outline"
              title={t('storageLocations.noLocations')}
              description={t('storageLocations.noLocationsDesc')}
              action={{
                label: t('storageLocations.addLocation'),
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
        title={t('storageLocations.title')}
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
