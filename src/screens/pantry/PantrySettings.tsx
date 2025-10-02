import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { Icon } from '#/utils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ApolloCache } from '@apollo/client';
import {
  useGetPantryQuery,
  useUpdatePantryMutation,
  useDeletePantryMutation,
  useCreatePantryMutation,
  GetPantriesDocument,
  GetPantriesQuery,
  GetHomesDocument,
  GetHomesQuery,
} from '#generated';
import { useStore } from '#store';
import { useAppNavigation } from '#hooks';
import { PantryStackParamList } from '#navigation/stacks/PantryStack';

export const PantrySettings: React.FC<{
  route: { params?: PantryStackParamList['PantrySettings'] };
}> = ({ route }) => {
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();
  const pantryId = route.params?.pantryId;

  const { selectedHomeId } = useStore();
  const setSelectedPantryId = useStore(state => state.setSelectedPantryId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: pantryData, loading: loadingPantry } = useGetPantryQuery({
    variables: { id: pantryId ?? '' },
    skip: !pantryId,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
  });

  const pantry = pantryData?.pantry;

  const [updatePantry] = useUpdatePantryMutation();
  const [deletePantry] = useDeletePantryMutation({
    update: (cache: ApolloCache, { data }: any) => {
      if (data?.deletePantry) {
        try {
          // Update GetHomes cache to remove the pantry
          const existingHomesData = cache.readQuery<GetHomesQuery>({
            query: GetHomesDocument,
          });

          if (existingHomesData?.homes) {
            const updatedHomes = existingHomesData.homes.map((home: any) => {
              if (home.pantries) {
                return {
                  ...home,
                  pantries: home.pantries.filter(
                    (p: any) => p.id !== data.deletePantry,
                  ),
                };
              }
              return home;
            });

            cache.writeQuery<GetHomesQuery>({
              query: GetHomesDocument,
              data: { homes: updatedHomes },
            });
          }
        } catch (error) {
          console.log('Cache update failed during delete:', error);
        }
      }
    },
  });

  const [createPantry] = useCreatePantryMutation({
    update: (cache: ApolloCache, { data }: any) => {
      if (data?.createPantry) {
        try {
          // Update GetHomes cache to include the new pantry
          const existingHomesData = cache.readQuery<GetHomesQuery>({
            query: GetHomesDocument,
          });

          if (existingHomesData?.homes) {
            const updatedHomes = existingHomesData.homes.map((home: any) => {
              if (home.id === data.createPantry.homeId) {
                const updatedHome = {
                  ...home,
                  pantries: [
                    ...(home.pantries || []),
                    {
                      id: data.createPantry.id,
                      name: data.createPantry.name,
                      isDefault: data.createPantry.isDefault,
                    },
                  ],
                };
                return updatedHome;
              }
              return home;
            });

            cache.writeQuery<GetHomesQuery>({
              query: GetHomesDocument,
              data: { homes: updatedHomes },
            });
          } else {
            console.log('No existing homes data found in cache');
          }

          // Also update GetPantries cache if it exists
          try {
            const existingPantriesData = cache.readQuery<GetPantriesQuery>({
              query: GetPantriesDocument,
              variables: { homeId: data.createPantry.homeId },
            });

            if (existingPantriesData?.pantries) {
              cache.writeQuery<GetPantriesQuery>({
                query: GetPantriesDocument,
                variables: { homeId: data.createPantry.homeId },
                data: {
                  pantries: [
                    ...existingPantriesData.pantries,
                    data.createPantry,
                  ],
                },
              });
            }
          } catch (pantryError) {
            console.log(
              'GetPantries cache not found or update failed:',
              pantryError,
            );
          }
        } catch (error) {
          console.log('Cache update failed during create:', error);
        }

        // Force refresh of GetHomes query to ensure stats update
        try {
          cache.evict({
            id: 'ROOT_QUERY',
            fieldName: 'homes',
          });
        } catch (evictError) {
          console.log('Failed to evict homes query:', evictError);
        }
      }
    },
    onCompleted: data => {
      if (data?.createPantry) {
        // Set the newly created pantry as selected if it's marked as default or if it's the first pantry
        if (isDefault) {
          setSelectedPantryId(data.createPantry.id);
        }
      }
      goBack();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to create pantry');
    },
  });

  useEffect(() => {
    console.log('🔧 PantrySettings useEffect:', {
      pantryId,
      hasPantryData: !!pantry,
      pantryName: pantry?.name,
      loading: loadingPantry
    });

    if (pantry && pantryId) {
      console.log('✅ Populating form with pantry data:', pantry.name);
      setName(pantry.name);
      setDescription(pantry.description || '');
      setIsDefault(pantry.isDefault);
    } else if (!pantryId) {
      // Set default values for new pantry
      console.log('🆕 Setting defaults for new pantry');
      setName('');
      setDescription('');
      setIsDefault(false);
    } else {
      console.log('⏳ Waiting for pantry data...');
    }
  }, [pantry, pantryId, loadingPantry]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Pantry name cannot be empty');
      return;
    }

    if (!selectedHomeId) {
      Alert.alert('Error', 'No home selected');
      return;
    }

    setSaving(true);
    try {
      if (!pantryId) {
        // Create new pantry
        await createPantry({
          variables: {
            input: {
              homeId: selectedHomeId,
              name: name.trim(),
              description: description.trim() || 'User created pantry',
              isDefault,
              tags: ['user-created'],
            },
          },
        });
      } else {
        // Update existing pantry
        await updatePantry({
          variables: {
            id: pantryId,
            input: {
              name: name.trim(),
              description: description.trim(),
            },
          },
        });
      }
    } catch (error) {
      Alert.alert(
        'Error',
        pantryId ? 'Failed to save settings' : 'Failed to create pantry',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!pantryId) return;

    Alert.alert(
      'Delete Pantry',
      'Are you sure you want to delete this pantry? This action cannot be undone and will remove all items in this pantry.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePantry({ variables: { id: pantryId } });
              goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete pantry');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {!pantryId ? 'Create New Pantry' : 'Pantry Settings'}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButton}>
            {saving ? 'Saving...' : !pantryId ? 'Create' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pantry Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter pantry name (e.g., Kitchen Pantry)"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description"
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Default Pantry</Text>
              <Text style={styles.settingDescription}>
                Make this your default pantry for this home
              </Text>
            </View>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ true: theme.colors.primary }}
            />
          </View>
        </View>

        {pantryId && pantry && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Information</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Items in pantry</Text>
              <Text style={styles.infoValue}>
                {pantry.items?.length || 0} items
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>
                {new Date(pantry.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        )}

        {/* Only show danger zone if editing existing pantry */}
        {pantryId && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Icon name="delete" size={20} color={theme.colors.error} />
              <Text style={styles.deleteButtonText}>Delete Pantry</Text>
            </TouchableOpacity>

            <Text style={styles.dangerWarning}>
              Deleting this pantry will permanently remove all items stored in
              it. This action cannot be undone.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: 'white',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: 8,
    marginBottom: 12,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.error,
    marginLeft: 8,
  },
  dangerWarning: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
}));
