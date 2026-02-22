import React, { useState } from 'react';
import {
  View,
  Alert,
  Text,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { useStorageLocationManagement } from '#hooks/storageLocation/useStorageLocationManagement';
import { StorageLocationCard } from '#components/organisms/storageLocation/StorageLocationCard';
import { StorageLocationSheet } from '#components/modals/StorageLocationSheet/StorageLocationSheet';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#utils/iconUtils';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';

type RouteParams = {
  homeId: string;
};

export const StorageLocationsScreen: React.FC<{
  route: { params: RouteParams };
}> = ({ route }) => {
  useScreenTransition('StorageLocationsScreen');
  const { homeId } = route.params;
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'flat' | 'tree'>('flat');
  const [refreshing, setRefreshing] = useState(false);

  const {
    locations,
    tree,
    initialLoading,
    creating,
    updateLocation,
    deleteLocation,
    setDefaultLocation,
    createLocation,
    error,
    refetch,
  } = useStorageLocationManagement(homeId);

  // Open sheet for editing
  const handleOpenEdit = (location: any) => {
    setEditingLocation(location);
    setSheetVisible(true);
  };

  // Close sheet
  const handleCloseSheet = () => {
    setSheetVisible(false);
    setEditingLocation(null);
  };

  // Recursive component to render tree structure
  const renderTreeNode = (node: any, depth: number = 0): React.ReactElement => (
    <View key={node.id} style={{ marginLeft: depth * 16 }}>
      <StorageLocationCard
        location={node}
        isDefault={node.isDefault}
        onEdit={() => handleOpenEdit(node)}
        onDelete={() => handleDelete(node.id, node.name)}
        onSetDefault={() => handleSetDefault(node.id)}
      />
      {node.childLocations?.map((child: any) =>
        renderTreeNode(child, depth + 1),
      )}
    </View>
  );

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

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete Storage Location',
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteLocation(id);
          },
        },
      ],
    );
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultLocation(id);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (initialLoading) {
    return (
      <DetailTemplate
        title="Storage Locations"
        onBack={goBack}
        headerActions={[]}
        sections={[
          {
            content: (
              <View style={commonStyles.loadingContainer}>
                <ActivityIndicator size="large" />
                <Text style={commonStyles.loadingText}>
                  Loading storage locations...
                </Text>
              </View>
            ),
          },
        ]}
      />
    );
  }

  const sections = [
    {
      content: (
        <>
          {/* Error Message */}
          {!!error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>
                Error loading storage locations: {error.message}
              </Text>
            </View>
          )}

          {/* View Mode Toggle */}
          {locations.length > 0 && (
            <View style={styles.viewModeToggle}>
              <Pressable
                style={({pressed}) => [
                  styles.toggleButton,
                  viewMode === 'flat' && styles.toggleButtonActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setViewMode('flat')}
              >
                <Icon name="list" size={20} />
                <Text
                  style={[
                    styles.toggleText,
                    viewMode === 'flat' && styles.toggleTextActive,
                  ]}
                >
                  List View
                </Text>
              </Pressable>
              <Pressable
                style={({pressed}) => [
                  styles.toggleButton,
                  viewMode === 'tree' && styles.toggleButtonActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setViewMode('tree')}
              >
                <Icon name="git-network" size={20} />
                <Text
                  style={[
                    styles.toggleText,
                    viewMode === 'tree' && styles.toggleTextActive,
                  ]}
                >
                  Tree View
                </Text>
              </Pressable>
            </View>
          )}

          {locations.length === 0 ? (
            <View style={commonStyles.emptyState}>
              <Icon
                name="server-outline"
                size={64}
                color={theme.colors.textSecondary}
              />
              <Text style={commonStyles.emptyStateTitle}>
                No Storage Locations
              </Text>
              <Text style={commonStyles.emptyStateText}>
                Create storage locations to organize your pantry items by where
                they're stored.
              </Text>
            </View>
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
                onDelete={() => handleDelete(location.id, location.name)}
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
        title="Storage Locations"
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
        isSubmitting={creating}
      />
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  errorCard: {
    backgroundColor: theme.colors.errorLight,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fonts.size.sm,
  },
  viewModeToggle: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.xs,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  toggleText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fonts.weight.medium,
  },
  toggleTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
