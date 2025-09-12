import {useMemo, useEffect, useCallback, useRef} from 'react';
import {Alert} from 'react-native';
import {
  useGetHomesQuery,
  useCreateHomeMutation,
  useUpdateHomeMutation,
  useDeleteHomeMutation,
  useInviteToHomeMutation,
  GetHomesQuery,
  GetHomesDocument,
  MembershipRole,
  useGetDefaultHomeQuery,
  useSetDefaultHomeMutation,
} from '#generated';
import {useSearchableList} from '../useSearchableList';
import {useStore} from '#store';

export function useHomeManagement() {
  const {selectedHomeId, setSelectedHomeId, setSelectedPantryId} = useStore();

  const {data, loading, error, refetch} = useGetHomesQuery({
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: defaultHomeData,
    loading: loadingDefaultHome,
    refetch: refetchDefaultHome,
  } = useGetDefaultHomeQuery({
    fetchPolicy: 'cache-and-network',
  });

  const [setDefaultHomeMutation] = useSetDefaultHomeMutation();
  const homes = data?.homes || [];
  const remoteDefaultHomeId = defaultHomeData?.getDefaultHome?.id;

  // Sync remote default home with local store on initial load and changes
  useEffect(() => {
    if (remoteDefaultHomeId && remoteDefaultHomeId !== selectedHomeId) {
      setSelectedHomeId(remoteDefaultHomeId);
    }
  }, [remoteDefaultHomeId, setSelectedHomeId]);

  // If local store has a value but remote doesn't, sync to remote
  useEffect(() => {
    const syncLocalToRemote = async () => {
      if (selectedHomeId && !remoteDefaultHomeId && !loadingDefaultHome) {
        // Verify the selectedHomeId still exists in the homes list
        const homeExists = homes.some(home => home.id === selectedHomeId);
        if (!homeExists) {
          console.warn('Selected home no longer exists, clearing selection');
          setSelectedHomeId(null);
          return;
        }

        try {
          await setDefaultHomeMutation({
            variables: {homeId: selectedHomeId},
          });
          refetchDefaultHome();
        } catch (error) {
          console.error('Failed to sync local default to remote:', error);
          // Don't show alert for background sync failures
        }
      }
    };

    syncLocalToRemote();
  }, [
    selectedHomeId,
    remoteDefaultHomeId,
    loadingDefaultHome,
    setDefaultHomeMutation,
    refetchDefaultHome,
    homes,
  ]);

  // Search functionality for homes
  const {query, setQuery, filtered} = useSearchableList(homes, (home, q) =>
    home?.name?.toLowerCase().includes(q.toLowerCase()),
  );

  // Add debugging to createHomeMutation
  const [createHomeMutation, {loading: creating}] = useCreateHomeMutation({
    update: (cache, {data}) => {
      if (data?.createHome) {
        const existingHomes = cache.readQuery<GetHomesQuery>({
          query: GetHomesDocument,
        });

        if (existingHomes?.homes) {
          // Now we can safely add the new home since it has compatible structure
          const newHomesArray = [...existingHomes.homes, data.createHome];

          cache.writeQuery<GetHomesQuery>({
            query: GetHomesDocument,
            data: {
              homes: newHomesArray,
            },
          });
        }

        // If this is the first home, set it as default
        if (!existingHomes?.homes?.length) {
          setSelectedHomeId(data.createHome.id);
          // Set as default home, but don't block the UI if this fails
          setDefaultHomeMutation({
            variables: {homeId: data.createHome.id},
          }).catch(error => {
            console.warn('Failed to set newly created home as default:', error);
            // Don't show alert here since the home was created successfully
          });
        }

        // If a default pantry was created, set it as selected
        const newHome = data.createHome;
        if (newHome.pantries && newHome.pantries.length > 0) {
          const defaultPantry = newHome.pantries.find(
            pantry => pantry.isDefault,
          );
          if (defaultPantry) {
            console.log('Setting default pantry:', defaultPantry.id);
            setSelectedPantryId(defaultPantry.id);
          }
        }
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to create home');
      console.error('Create home error:', error);
    },
  });

  // Add debugging to updateHomeMutation
  const [updateHomeMutation, {loading: updating}] = useUpdateHomeMutation({
    update: (cache, {data}) => {
      if (data?.updateHome) {
        const existingHomes = cache.readQuery<GetHomesQuery>({
          query: GetHomesDocument,
        });

        if (existingHomes?.homes) {
          const updatedHomes = existingHomes.homes.map(home => {
            if (home.id === data.updateHome.id) {
              return data.updateHome;
            }
            return home;
          });

          cache.writeQuery<GetHomesQuery>({
            query: GetHomesDocument,
            data: {
              homes: updatedHomes,
            },
          });
        }
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to update home');
      console.error('Update home error:', error);
    },
  });

  // Add debugging to deleteHomeMutation
  const [deleteHomeMutation, {loading: deleting}] = useDeleteHomeMutation({
    update: (cache, {data}) => {
      if (data?.deleteHome) {
        const existingHomes = cache.readQuery<GetHomesQuery>({
          query: GetHomesDocument,
        });

        if (existingHomes?.homes) {
          const filteredHomes = existingHomes.homes.filter(
            home => home.id !== data.deleteHome.id,
          );

          cache.writeQuery<GetHomesQuery>({
            query: GetHomesDocument,
            data: {
              homes: filteredHomes,
            },
          });

          // If deleted home was the default, clear it or set another
          if (data.deleteHome.id === selectedHomeId) {
            const newDefaultHome = filteredHomes[0];
            if (newDefaultHome) {
              setSelectedHomeId(newDefaultHome.id);
              setDefaultHomeMutation({
                variables: {homeId: newDefaultHome.id},
              });
            } else {
              setSelectedHomeId(null);
            }
          }
        }
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to delete home');
      console.error('Delete home error:', error);
    },
  });

  // Invite user to home mutation
  const [inviteUserMutation, {loading: inviting}] = useInviteToHomeMutation();

  // Helper functions
  const createHome = async (
    name: string,
    createDefaultPantry: boolean = true,
  ) => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a home name');
      return false;
    }

    try {
      const result = await createHomeMutation({
        variables: {
          input: {
            name: name.trim(),
            createDefaultPantry,
          },
        },
      });

      if (result.data?.createHome) {
        const newHome = result.data.createHome;

        // If a default pantry was created, set it as selected in the store
        if (newHome.pantries && newHome.pantries.length > 0) {
          const defaultPantry = newHome.pantries.find(
            pantry => pantry.isDefault,
          );
          if (defaultPantry) {
            console.log(
              'Setting default pantry after home creation:',
              defaultPantry.id,
            );
            setSelectedPantryId(defaultPantry.id);
          }
        }

        return newHome;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const updateHome = async (
    homeId: string,
    updates: {name?: string; isDefault?: boolean},
  ) => {
    try {
      // Handle default home update separately if needed
      if (updates.isDefault !== undefined && updates.isDefault) {
        await setDefaultHome(homeId);
        delete updates.isDefault; // Remove from updates since we handle it separately
      }

      if (Object.keys(updates).length > 0) {
        const result = await updateHomeMutation({
          variables: {
            id: homeId,
            input: updates,
          },
        });

        if (result.data?.updateHome) {
          Alert.alert('Success', 'Home updated successfully');
          return result.data.updateHome;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  };

  const deleteHome = async (homeId: string, homeName: string) => {
    return new Promise<boolean>(resolve => {
      Alert.alert(
        'Delete Home',
        `Are you sure you want to delete "${homeName}"?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteHomeMutation({
                  variables: {id: homeId},
                });
                resolve(true);
              } catch (error) {
                resolve(false);
              }
            },
          },
        ],
      );
    });
  };

  const setDefaultHome = async (homeId: string) => {
    // Validate homeId exists
    if (!homeId) {
      Alert.alert('Error', 'Invalid home ID');
      return false;
    }

    // Check if home exists
    const homeExists = homes.some(home => home.id === homeId);
    if (!homeExists) {
      Alert.alert('Error', 'Home not found');
      return false;
    }

    try {
      // Update local state immediately for responsive UI
      setSelectedHomeId(homeId);

      // Sync to remote
      const result = await setDefaultHomeMutation({
        variables: {homeId},
      });

      if (result.data) {
        // Refetch to ensure cache is updated
        await refetchDefaultHome();
        return true;
      }

      // Rollback on failure
      setSelectedHomeId(remoteDefaultHomeId || null);
      return false;
    } catch (error) {
      // Rollback on error
      setSelectedHomeId(remoteDefaultHomeId || null);
      Alert.alert('Error', 'Failed to set default home');
      return false;
    }
  };

  const inviteUserToHome = async (
    homeId: string,
    email: string,
    role: MembershipRole = MembershipRole.Member,
  ) => {
    const result = await inviteUserMutation({
      variables: {
        input: {
          homeId,
          email: email.trim(),
          role,
        },
      },
    });

    return result.data;
  };

  // Track the last known pantries count to avoid flickering to 0 during refetch
  const lastKnownPantriesCount = useRef<number>(0);

  // Statistics and computed values
  const stats = useMemo(() => {
    const validHomes = Array.isArray(homes) ? homes.filter(Boolean) : [];

    validHomes.forEach((home, index) => {
      const pantriesCount = Array.isArray(home?.pantries)
        ? home.pantries.length
        : home.pantries === null
          ? 'loading'
          : 0;
    });

    // Check if all homes have loaded their pantries data
    const allHomesLoaded = validHomes.every(home => home.pantries !== null);

    let totalPantries: number;

    if (allHomesLoaded) {
      // All data is loaded, calculate the actual count
      totalPantries = validHomes.reduce((acc, home) => {
        const count = Array.isArray(home?.pantries) ? home.pantries.length : 0;
        return acc + count;
      }, 0);
      // Update our last known count
      lastKnownPantriesCount.current = totalPantries;
    } else {
      // Some data is still loading, use the last known count to prevent flickering
      totalPantries = lastKnownPantriesCount.current;
    }

    const result = {
      totalHomes: validHomes.length,
      totalMembers: validHomes.reduce((acc, home) => {
        const count = Array.isArray(home?.members) ? home.members.length : 0;
        return acc + count;
      }, 0),
      totalPantries,
    };

    return result;
  }, [homes]);
  // Computed value for current default home
  const defaultHome = useMemo(() => {
    return homes.find(home => home.id === selectedHomeId) || null;
  }, [homes, selectedHomeId]);

  const isSynced = selectedHomeId === remoteDefaultHomeId;

  // Memoize the refetch function to prevent unnecessary re-renders
  const memoizedRefetch = useCallback(async () => {
    await Promise.all([refetch(), refetchDefaultHome()]);
  }, [refetch, refetchDefaultHome]);

  return {
    // Data
    homes: filtered,
    allHomes: homes,
    defaultHome,
    defaultHomeId: selectedHomeId,
    remoteDefaultHomeId,
    isSynced,
    loading: loading || loadingDefaultHome,
    error,
    stats,

    // Search
    searchQuery: query,
    setSearchQuery: setQuery,

    // Loading states
    creating,
    updating,
    deleting,
    inviting,

    // Actions
    createHome,
    updateHome,
    deleteHome,
    setDefaultHome,
    inviteUserToHome,
    refetch: memoizedRefetch,
  };
}
