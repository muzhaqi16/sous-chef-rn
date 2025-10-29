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
  useJoinHomeByCodeMutation,
  useGetHomeByJoinCodeLazyQuery,
  GetDefaultHomeDocument,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { useStore } from '#store';
import { useErrorHandler } from '#/utils/errorHandling';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { usePreservedArrayData } from '#/hooks/apollo';

export function useHomeManagement() {
  const { selectedHomeId, setSelectedHomeId, setSelectedPantryId } = useStore();
  const { handleApolloError } = useErrorHandler();

  // Ref to track if initial home auto-selection has been attempted
  const hasInitializedDefaultHome = useRef(false);

  const { data, loading, error, refetch } = useGetHomesQuery({
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first', // Subsequent fetches use cache to avoid unnecessary refetches
    errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
  });

  const {
    data: defaultHomeData,
    loading: loadingDefaultHome,
    refetch: refetchDefaultHome,
  } = useGetDefaultHomeQuery({
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first', // Subsequent fetches use cache to avoid unnecessary refetches
    errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
  });

  const [setDefaultHomeMutation] = useSetDefaultHomeMutation({
    // Update cache directly instead of refetching
    update: (cache, { data }) => {
      if (!data?.setDefaultHome) return;

      try {
        // Find the home that was set as default
        const homeId = data.setDefaultHome.id;
        const home = homes?.find(h => h.id === homeId);

        if (home) {
          // Write the default home query result to cache
          cache.writeQuery({
            query: GetDefaultHomeDocument,
            data: {
              getDefaultHome: home,
            },
          });
        }
      } catch (error) {
        console.warn('Cache update failed for setDefaultHome:', error);
        // Fallback: refetch only on error
        refetchDefaultHome();
      }
    },
  });

  // Preserve homes even when query fails to prevent cascade failures
  const homes = usePreservedArrayData(data?.homes);
  const remoteDefaultHomeId = defaultHomeData?.getDefaultHome?.id;

  // NOTE: Remote sync logic removed from here to prevent infinite loop
  // The sync from remote → local is now handled ONLY by useDefaultHome hook
  // This hook (useHomeManagement) should only handle ACTIONS (mutations), not passive syncing

  // Auto-select first home if no default is set and we have homes (initialization for first-time users)
  // This runs ONCE when the user has homes but no default home set anywhere
  useEffect(() => {
    if (
      !hasInitializedDefaultHome.current &&
      !selectedHomeId &&
      !remoteDefaultHomeId &&
      !loadingDefaultHome &&
      homes &&
      homes.length > 0
    ) {
      hasInitializedDefaultHome.current = true; // Mark as done
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
    (home: any, q: string) =>
      home?.name?.toLowerCase().includes(q.toLowerCase()),
  );

  const [createHomeMutation, { loading: creating, client }] =
    useCreateHomeMutation({
      // Note: No optimisticResponse - the mutation returns complex nested types
      // (members, myMembership with 15+ fields, pantries, membershipStats, etc.)
      // Cache update provides instant UI feedback when server responds (~100-200ms)
      // Update cache directly instead of refetching
      update: (cache, { data }) => {
        if (!data?.createHome) return;

        try {
          const newHome = data.createHome;

          // Add new home to the homes list in cache
          cache.modify({
            fields: {
              homes(existingHomes = [], { toReference }) {
                const newHomeRef = toReference(newHome);

                // Check if home already exists (avoid duplicates)
                const exists = existingHomes.some((homeRef: any) => {
                  const id = cache.identify(homeRef);
                  return id === cache.identify(newHome);
                });

                if (exists) {
                  return existingHomes;
                }

                return [...existingHomes, newHomeRef];
              },
            },
          });
        } catch (error) {
          console.warn('Cache update failed for createHome:', error);
          // Fallback: refetch if cache update fails
          refetch();
        }
      },
      onCompleted: async data => {
        if (data?.createHome) {
          const newHome = data.createHome;

          // Read fresh data from Apollo cache (no refetch needed!)
          const cachedData = client.cache.readQuery({
            query: GetHomesDocument,
          }) as { homes: any[] } | null;
          const freshHomes = cachedData?.homes ?? [];

          // Only set as default if this is truly the first/only home
          if (freshHomes.length === 1 && freshHomes[0].id === newHome.id) {
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
    onCompleted: data => {
      if (data?.updateHome) {
        Alert.alert('Success', 'Home updated successfully');
      }
    },
    onError: (error: any) => {
      // Handle version conflicts with user-friendly message
      if (handleVersionConflict(error)) {
        Alert.alert('Home Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      const { message } = handleApolloError(error, {
        operation: 'Update Home',
      });
      Alert.alert('Error', message);
    },
  });

  const [deleteHomeMutation, { loading: deleting, client: deleteClient }] =
    useDeleteHomeMutation({
      // Note: No optimisticResponse - the mutation returns full HomeFragment (20+ fields)
      // Cache update provides instant UI feedback when server responds (~100-200ms)
      // Update cache to remove the home
      update: (cache, { data }, { variables }) => {
        if (!data?.deleteHome || !variables) return;

        try {
          const deletedHomeId = variables.id;

          // Remove the home from the homes list in cache
          cache.modify({
            fields: {
              homes(existingHomes = [], { readField }) {
                return existingHomes.filter(
                  (homeRef: any) => readField('id', homeRef) !== deletedHomeId,
                );
              },
            },
          });

          // Evict the removed home from cache
          cache.evict({
            id: cache.identify({ __typename: 'Home', id: deletedHomeId }),
          });
          cache.gc(); // Garbage collect orphaned data
        } catch (error) {
          console.warn('Cache update failed for deleteHome:', error);
          refetch();
        }
      },
      onCompleted: async data => {
        if (data?.deleteHome) {
          // If deleted home was the default, clear it or set another
          if (data.deleteHome.id === selectedHomeId) {
            // Read fresh data from Apollo cache (no refetch needed!)
            const cachedData = deleteClient.cache.readQuery({
              query: GetHomesDocument,
            }) as { homes: any[] } | null;
            const remainingHomes = cachedData?.homes ?? [];

            if (remainingHomes.length > 0) {
              // Set first remaining home as default
              const newDefaultHome = remainingHomes[0];
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
              // No homes left, clear the selection
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
  const [inviteUserMutation, { loading: inviting }] = useInviteToHomeMutation({
    // Cache update to add the new invite/member
    update: (cache, { data }, { variables }) => {
      if (!data?.inviteToHome || !variables) return;

      try {
        const homeId = variables.input.homeId;

        // Update the home's members list if the invite data includes member info
        if (data.inviteToHome) {
          cache.modify({
            id: cache.identify({ __typename: 'Home', id: homeId }),
            fields: {
              members(existingMembers = [], { toReference: _toReference }) {
                // Note: The invite might not immediately add a member until accepted
                // This depends on your backend implementation
                // For now, we'll just let the subscription handle the update
                return existingMembers;
              },
            },
          });
        }

        // Note: We don't need to manually update homeInvites query
        // because the subscription should handle that automatically
      } catch (error) {
        console.warn('Cache update failed for inviteUser:', error);
        // No need to refetch - subscription will update
      }
    },

    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Invite User',
      });
      Alert.alert('Error', message);
    },
  });

  // Join home by code mutation
  const [joinHomeByCodeMutation, { loading: joiningByCode }] =
    useJoinHomeByCodeMutation({
      update: (_cache, { data }) => {
        if (!data?.joinHomeByCode) return;

        try {
          // The home should now be in the homes list
          // We need to refetch to get the full home data with pantries, etc.
          refetch();
        } catch (error) {
          console.warn('Cache update failed for joinHomeByCode:', error);
          refetch();
        }
      },
      onCompleted: data => {
        if (data?.joinHomeByCode) {
          const homeId = data.joinHomeByCode.homeId;

          // Set as default if this is the first home
          const freshHomes = homes || [];
          if (freshHomes.length === 0) {
            setSelectedHomeId(homeId);
            setDefaultHomeMutation({
              variables: { homeId },
            }).catch((error: any) => {
              const { message } = handleApolloError(error, {
                operation: 'Set Default Home After Join',
              });
              console.warn('Failed to set default home after join:', message);
            });
          }

          Alert.alert('Success', 'You have successfully joined the home!');
        }
      },
      onError: (error: any) => {
        const { message } = handleApolloError(error, {
          operation: 'Join Home By Code',
        });
        Alert.alert('Error', message);
      },
    });

  // Preview home by join code query
  const [getHomeByJoinCode, { loading: loadingPreview, data: previewData }] =
    useGetHomeByJoinCodeLazyQuery({
      fetchPolicy: 'network-only', // Always fetch fresh data
    });

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
    // Prevent redundant calls if already set as default (check both local and remote)
    if (homeId === selectedHomeId && homeId === remoteDefaultHomeId) {
      return true;
    }

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
      // Call mutation first - the useDefaultHome sync effect will update local state
      // when Apollo cache is updated by the mutation response
      const result = await setDefaultHomeMutation({
        variables: { homeId },
      });

      if (result.data) {
        // No need to manually update local state - useDefaultHome's sync effect handles it
        return true;
      }

      return false;
    } catch (error: any) {
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
      // No refetchQueries needed - cache updates handled in mutation's update function
    });

    return result.data;
  };

  const joinHomeByCode = async (joinCode: string) => {
    if (!joinCode.trim()) {
      Alert.alert('Error', 'Please enter a join code');
      return false;
    }

    try {
      const result = await joinHomeByCodeMutation({
        variables: { joinCode: joinCode.trim() },
      });

      return result.data?.joinHomeByCode || false;
    } catch (error: any) {
      return false;
    }
  };

  const previewHomeByCode = async (joinCode: string) => {
    if (!joinCode.trim()) {
      return null;
    }

    try {
      const result = await getHomeByJoinCode({
        variables: { joinCode: joinCode.trim() },
      });

      return result.data?.homeByJoinCode || null;
    } catch (error: any) {
      const { message } = handleApolloError(error, {
        operation: 'Preview Home',
      });
      Alert.alert('Error', message);
      return null;
    }
  };

  // Track the last known pantries count to avoid flickering to 0 during refetch
  const lastKnownPantriesCount = useRef<number>(0);

  // Statistics and computed values
  const stats = useMemo(() => {
    const validHomes = Array.isArray(homes) ? homes.filter(Boolean) : [];

    // Check if all homes have loaded their pantries data
    const allHomesLoaded = validHomes.every(
      (home: any) => home.pantries !== null,
    );

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
    initialLoading: (!homes && loading) || (!defaultHomeData && loadingDefaultHome),
    error,
    stats,
    previewHome: previewData?.homeByJoinCode || null,

    // Search
    searchQuery: query,
    setSearchQuery: setQuery,

    // Loading states
    creating,
    updating,
    deleting,
    inviting,
    joiningByCode,
    loadingPreview,

    // Actions
    createHome,
    updateHome,
    deleteHome,
    setDefaultHome,
    inviteUserToHome,
    joinHomeByCode,
    previewHomeByCode,
    refetch: memoizedRefetch,
  };
}
