import {useMemo, useEffect} from 'react';
import {Platform, Alert} from 'react-native';
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
  const {selectedHomeId, setSelectedHomeId} = useStore();

  const {data, loading, error, refetch} = useGetHomesQuery({
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: defaultHomeData,
    loading: loadingDefaultHome,
    refetch: refetchDefaultHome,
  } = useGetDefaultHomeQuery({
    fetchPolicy: 'cache-and-network',
  });

  const [setDefaultHomeMutation] = useSetDefaultHomeMutation({
    onError: error => {
      Alert.alert('Error', 'Failed to set default home');
      console.error('Set default home error:', error);
    },
  });

  const homes = data?.homes || [];
  const remoteDefaultHomeId = defaultHomeData?.getDefaultHome?.id;

  // Sync remote default home with local store on initial load and changes
  useEffect(() => {
    if (remoteDefaultHomeId && remoteDefaultHomeId !== selectedHomeId) {
      console.log(
        'Syncing remote default home to local store:',
        remoteDefaultHomeId,
      );
      setSelectedHomeId(remoteDefaultHomeId);
    }
  }, [remoteDefaultHomeId, setSelectedHomeId]);

  // If local store has a value but remote doesn't, sync to remote
  useEffect(() => {
    const syncLocalToRemote = async () => {
      if (selectedHomeId && !remoteDefaultHomeId && !loadingDefaultHome) {
        console.log('Syncing local default home to remote:', selectedHomeId);
        try {
          await setDefaultHomeMutation({
            variables: {homeId: selectedHomeId},
          });
          refetchDefaultHome();
        } catch (error) {
          console.error('Failed to sync local default to remote:', error);
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
  ]);

  // Search functionality for homes
  const {query, setQuery, filtered} = useSearchableList(homes, (home, q) =>
    home?.name?.toLowerCase().includes(q.toLowerCase()),
  );

  // Create home mutation
  const [createHomeMutation, {loading: creating}] = useCreateHomeMutation({
    update: (cache, {data}) => {
      if (data?.createHome) {
        const existingHomes = cache.readQuery<GetHomesQuery>({
          query: GetHomesDocument,
        });

        if (existingHomes?.homes) {
          cache.writeQuery<GetHomesQuery>({
            query: GetHomesDocument,
            data: {
              homes: [...existingHomes.homes, data.createHome],
            },
          });
        }

        // If this is the first home, set it as default
        if (!existingHomes?.homes?.length) {
          setSelectedHomeId(data.createHome.id);
          setDefaultHomeMutation({
            variables: {homeId: data.createHome.id},
          });
        }
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to create home');
      console.error('Create home error:', error);
    },
  });

  // Update home mutation
  const [updateHomeMutation, {loading: updating}] = useUpdateHomeMutation({
    update: (cache, {data}) => {
      if (data?.updateHome) {
        const existingHomes = cache.readQuery<GetHomesQuery>({
          query: GetHomesDocument,
        });

        if (existingHomes?.homes) {
          const updatedHomes = existingHomes.homes.map(home =>
            home.id === data.updateHome.id ? data.updateHome : home,
          );

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

  // Delete home mutation
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
  const [inviteUserMutation, {loading: inviting}] = useInviteToHomeMutation({
    onError: error => {
      Alert.alert('Error', 'Failed to send invitation');
      console.error('Invite user error:', error);
    },
  });

  // Helper functions
  const createHome = async (name: string) => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a home name');
      return false;
    }

    try {
      const result = await createHomeMutation({
        variables: {input: {name: name.trim()}},
      });

      if (result.data?.createHome) {
        Alert.alert('Success', 'Home created successfully');
        return result.data.createHome;
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
    try {
      await inviteUserMutation({
        variables: {
          input: {
            homeId,
            email: email.trim(),
            role,
          },
        },
      });

      Alert.alert('Success', 'Invitation sent');
      return true;
    } catch (error) {
      return false;
    }
  };

  // Statistics and computed values
  const stats = useMemo(() => {
    return {
      totalHomes: homes.length,
      totalMembers: homes.reduce(
        (acc, home) => acc + (home.members?.length || 0),
        0,
      ),
      totalPantries: homes.reduce(
        (acc, home) => acc + (home.pantries?.length || 0),
        0,
      ),
    };
  }, [homes]);

  // Computed value for current default home
  const defaultHome = useMemo(() => {
    return homes.find(home => home.id === selectedHomeId) || null;
  }, [homes, selectedHomeId]);

  const isSynced = selectedHomeId === remoteDefaultHomeId;

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
    refetch: async () => {
      await Promise.all([refetch(), refetchDefaultHome()]);
    },
  };
}
