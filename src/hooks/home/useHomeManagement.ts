import { useMemo, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import {
  useGetHomesQuery,
  useCreateHomeMutation,
  useUpdateHomeMutation,
  useDeleteHomeMutation,
  useInviteToHomeMutation,
  GetHomesDocument,
  MembershipRole,
  useGetDefaultHomeQuery,
  useSetDefaultHomeMutation,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { useStore } from '#store';
import { useErrorHandler } from '#/utils/errorHandling';

export function useHomeManagement() {
  const { selectedHomeId, setSelectedHomeId, setSelectedPantryId } = useStore();
  const { handleApolloError } = useErrorHandler();

  const { data, loading, error, refetch } = useGetHomesQuery({
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
  const homes = data?.homes;
  const remoteDefaultHomeId = defaultHomeData?.getDefaultHome?.id;

  // Sync remote default home with local store on initial load and changes
  useEffect(() => {
    if (remoteDefaultHomeId && remoteDefaultHomeId !== selectedHomeId) {
      setSelectedHomeId(remoteDefaultHomeId);
    }
  }, [remoteDefaultHomeId, selectedHomeId, setSelectedHomeId]);

  // If local store has a value but remote doesn't, sync to remote
  useEffect(() => {
    const syncLocalToRemote = async () => {
      if (selectedHomeId && !remoteDefaultHomeId && !loadingDefaultHome) {
        // Verify the selectedHomeId still exists in the homes list
        const homeExists = homes?.some((home: any) => home.id === selectedHomeId);
        if (!homeExists) {
          setSelectedHomeId(null);
          return;
        }

        try {
          await setDefaultHomeMutation({
            variables: { homeId: selectedHomeId },
          });
          refetchDefaultHome();
        } catch (error: any) {
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
    homes,
    refetchDefaultHome,
    setSelectedHomeId,
  ]);

  // Auto-select first home if no default is set and we have homes (initialization for first-time users)
  useEffect(() => {
    if (
      !selectedHomeId &&
      !remoteDefaultHomeId &&
      !loadingDefaultHome &&
      homes &&
      homes.length > 0
    ) {
      // If there's no default set anywhere, select the first home and set it as default
      const firstHome = homes[0];
      setSelectedHomeId(firstHome.id);

      // Sync this choice to the backend
      setDefaultHomeMutation({
        variables: { homeId: firstHome.id },
      }).catch((error: any) => {
        const { message } = handleApolloError(error, {
          operation: 'Set First Home as Default',
        });
        console.warn('Failed to set first home as default:', message);
      });
    }
  }, [
    selectedHomeId,
    remoteDefaultHomeId,
    loadingDefaultHome,
    homes,
    setDefaultHomeMutation,
    handleApolloError,
    setSelectedHomeId,
  ]);

  // Search functionality for homes
  const { query, setQuery, filtered } = useSearchableList(
    homes,
    (home: any, q: string) => home?.name?.toLowerCase().includes(q.toLowerCase()),
  );

  const [createHomeMutation, { loading: creating }] = useCreateHomeMutation({
    refetchQueries: [{ query: GetHomesDocument }],
    onCompleted: (data) => {
      if (data?.createHome) {
        const newHome = data.createHome;

        // If this is the first home, set it as default
        if (!homes?.length) {
          setSelectedHomeId(newHome.id);
          setDefaultHomeMutation({
            variables: { homeId: newHome.id },
          }).catch((error: any) => {
            const { message } = handleApolloError(error, {
              operation: 'Set Default Home',
            });
            console.warn(
              'Failed to set newly created home as default:',
              message,
            );
          });
        }

        // If a default pantry was created, set it as selected
        if (newHome.pantries && newHome.pantries.length > 0) {
          const defaultPantry = newHome.pantries.find(
            (pantry: any) => pantry.isDefault,
          );
          if (defaultPantry) {
            setSelectedPantryId(defaultPantry.id);
          }
        }
      }
    },
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Create Home',
      });
      Alert.alert('Error', message);
    },
  });

  const [updateHomeMutation, { loading: updating }] = useUpdateHomeMutation({
    onCompleted: (data) => {
      if (data?.updateHome) {
        Alert.alert('Success', 'Home updated successfully');
      }
    },
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Update Home',
      });
      Alert.alert('Error', message);
    },
  });

  const [deleteHomeMutation, { loading: deleting }] = useDeleteHomeMutation({
    refetchQueries: [{ query: GetHomesDocument }],
    onCompleted: (data) => {
      if (data?.deleteHome) {
        // If deleted home was the default, clear it or set another
        if (data.deleteHome.id === selectedHomeId) {
          const remainingHomes = homes?.filter(
            (home: any) => home.id !== data.deleteHome.id,
          ) || [];

          const newDefaultHome = remainingHomes[0];
          if (newDefaultHome) {
            setSelectedHomeId(newDefaultHome.id);
            setDefaultHomeMutation({
              variables: { homeId: newDefaultHome.id },
            }).catch((error: any) => {
              const { message } = handleApolloError(error, {
                operation: 'Set Default Home After Delete',
              });
              console.warn(
                'Failed to set new default home after delete:',
                message,
              );
            });
          } else {
            setSelectedHomeId(null);
          }
        }
      }
    },
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Delete Home',
      });
      Alert.alert('Error', message);
    },
  });

  // Invite user to home mutation
  const [inviteUserMutation, { loading: inviting }] = useInviteToHomeMutation();

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

      return result.data?.createHome || false;
    } catch (error: any) {
      return false;
    }
  };

  const updateHome = async (
    homeId: string,
    updates: { name?: string; isDefault?: boolean },
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

        return result.data?.updateHome || false;
      }

      return true;
    } catch (error: any) {
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
                  variables: { id: homeId },
                });
                resolve(true);
              } catch (error: any) {
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
    const homeExists = homes?.some((home: any) => home.id === homeId);
    if (!homeExists) {
      Alert.alert('Error', 'Home not found');
      return false;
    }

    try {
      // Update local state immediately for responsive UI
      setSelectedHomeId(homeId);

      // Sync to remote
      const result = await setDefaultHomeMutation({
        variables: { homeId },
      });

      if (result.data) {
        // Refetch to ensure cache is updated
        await refetchDefaultHome();
        return true;
      }

      // Rollback on failure
      setSelectedHomeId(remoteDefaultHomeId || null);
      return false;
    } catch (error: any) {
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

    // Check if all homes have loaded their pantries data
    const allHomesLoaded = validHomes.every((home: any) => home.pantries !== null);

    let totalPantries: number;

    if (allHomesLoaded) {
      // All data is loaded, calculate the actual count
      totalPantries = validHomes.reduce((acc, home: any) => {
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
      totalMembers: validHomes.reduce((acc, home: any) => {
        const count = Array.isArray(home?.members) ? home.members.length : 0;
        return acc + count;
      }, 0),
      totalPantries,
    };

    return result;
  }, [homes]);
  // Computed value for current default home
  const defaultHome = useMemo(() => {
    return homes?.find((home: any) => home.id === selectedHomeId) || null;
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
