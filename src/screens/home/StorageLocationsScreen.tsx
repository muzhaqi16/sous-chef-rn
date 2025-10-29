import React, { useState } from 'react';
import {
  View,
  Alert,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks';
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { useStorageLocationManagement } from '#hooks';
import {
  StorageLocationCard,
  StorageLocationForm,
} from '#components/organisms/storageLocation';
import { commonStyles } from '#styles';
import { Icon } from '#utils';

type RouteParams = {
  homeId: string;
};

export const StorageLocationsScreen: React.FC<{
  route: { params: RouteParams };
}> = ({ route }) => {
  const { homeId } = route.params;
  const { goBack } = useAppNavigation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'flat' | 'tree'>('flat');

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
  } = useStorageLocationManagement(homeId);

  // Recursive component to render tree structure
  const renderTreeNode = (node: any, depth: number = 0): React.ReactElement => (
    <View key={node.id} style={{ marginLeft: depth * 16 }}>
      <StorageLocationCard
        location={node}
        isDefault={node.isDefault}
        onEdit={() => setEditingId(node.id)}
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
    if (result) {
      setShowCreateForm(false);
    }
  };

  const handleUpdate = async (id: string, formData: any) => {
    const result = await updateLocation(id, formData);
    if (result) {
      setEditingId(null);
    }
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

  const editingLocation = editingId
    ? locations.find(loc => loc.id === editingId)
    : null;

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
        <View style={styles.contentContainer}>
          {/* Title and count */}
          <Text style={styles.sectionTitle}>
            Storage Locations ({locations.length})
          </Text>

          {/* Error Message */}
          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>
                Error loading storage locations: {error.message}
              </Text>
            </View>
          )}

          {/* View Mode Toggle */}
          {locations.length > 0 && !showCreateForm && !editingId && (
            <View style={styles.viewModeToggle}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  viewMode === 'flat' && styles.toggleButtonActive,
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
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  viewMode === 'tree' && styles.toggleButtonActive,
                ]}
                onPress={() => setViewMode('tree')}
              >
                <Icon name="git-network" size={20} library="Ionicons" />
                <Text
                  style={[
                    styles.toggleText,
                    viewMode === 'tree' && styles.toggleTextActive,
                  ]}
                >
                  Tree View
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {showCreateForm && (
            <StorageLocationForm
              onSubmit={handleCreate}
              onCancel={() => setShowCreateForm(false)}
              isSubmitting={creating}
              availableLocations={locations}
            />
          )}

          {editingLocation && (
            <StorageLocationForm
              initialData={editingLocation}
              onSubmit={data => handleUpdate(editingLocation.id, data)}
              onCancel={() => setEditingId(null)}
              isSubmitting={false}
              availableLocations={locations}
            />
          )}

          {locations.length === 0 && !showCreateForm ? (
            <View style={commonStyles.emptyState}>
              <Text style={styles.emptyIcon}>📦</Text>
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
                onEdit={() => setEditingId(location.id)}
                onDelete={() => handleDelete(location.id, location.name)}
                onSetDefault={() => handleSetDefault(location.id)}
              />
            ))
          )}
        </View>
      ),
    },
  ];

  return (
    <DetailTemplate
      title="Storage Locations"
      onBack={goBack}
      headerActions={[
        {
          icon: 'add',
          onPress: () => {
            setEditingId(null);
            setShowCreateForm(true);
          },
        },
      ]}
      sections={sections}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  contentContainer: {
    margin: -16, // Negate DetailTemplate section padding
    padding: 0,
  },
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
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fonts.size.sm,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  viewModeToggle: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
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
}));
