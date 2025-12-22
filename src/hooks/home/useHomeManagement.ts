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
  useSetDefaultHomeMutation,
  useJoinHomeByCodeMutation,
  useGetHomeByJoinCodeLazyQuery,
  useGetDefaultPantryLazyQuery,
} from '#generated';
import { useShallow } from 'zustand/shallow';
import { useAppStore, selectSelectedHomeId, selectHomeState } from '#store/useAppStore';
import { useErrorHandler } from '#/utils/errorHandling';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { usePreservedArrayData } from '#/hooks/apollo';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { normalizeHome, normalizeHomes } from '#/utils/connectionUtils';
import {
  createAddToQueryFieldUpdater,
  createRemoveFromQueryFieldUpdater,
} from '#/apollo/utils';
import { useCrudOperations } from '#/hooks/utils';

// Cache updater utilities for homes
const addToHomesCache = createAddToQueryFieldUpdater('homes');
const removeFromHomesCache = createRemoveFromQueryFieldUpdater('homes', 'Home');

export function useHomeManagement() {
  const selectedHomeId = useAppStore(selectSelectedHomeId);
  const {setSelectedHomeId} = useAppStore(useShallow(selectHomeState));
  const setSelectedPantryId = useAppStore(state => state.setSelectedPantryId);
  const { handleApolloError } = useErrorHandler();

  // Ref to track if initial home auto-selection has been attempted
  const hasInitializedDefaultHome = useRef(false);

  // PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
  // - cache-and-network: Shows cached data immediately, fetches fresh in background
  // - nextFetchPolicy: 'cache-first' prevents re-fetches on subsequent renders
  // - errorPolicy: 'ignore' returns cached data when network fails (offline graceful degradation)

  const { data, loading, error, refetch } = useGetHomesQuery({
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
  });

  const [setDefaultHomeMutation] = useSetDefaultHomeMutation({
    errorPolicy: 'all',

    // Optimistic response for instant UI updates (especially offline)
    optimisticResponse: variables => ({
      __typename: 'Mutation',
      setDefaultHome: {
        __typename: 'UserSettings',
        id: variables.homeId,
      },
    }),

    // Update Apollo cache to set isDefault on the correct home
    update: (cache, _result, { variables }) => {
      if (!variables?.homeId) return;

      // Update isDefault field on all homes in cache
      cache.modify({
        fields: {
          homes: (existingHomes = [], { readField }) => {
            return existingHomes.map((homeRef: any) => {
              const homeId = readField('id', homeRef);
              // Update isDefault field on each home
              cache.modify({
                id: cache.identify(homeRef),
                fields: {
                  isDefault: () => homeId === variables.homeId,
                },
              });
              return homeRef;
            });
          },
        },
      });
    },
  });

  // Preserve homes even when query fails to prevent cascade failures
  const preservedHomes = usePreservedArrayData(data?.homes);
  const homes = useMemo(
    () => normalizeHomes(preservedHomes),
    [preservedHomes],
  );

  // Derive default home from isDefault field (no separate query needed)
  const remoteDefaultHomeId = useMemo(
    () => preservedHomes?.find((h: any) => h.isDefault)?.id ?? null,
    [preservedHomes],
  );

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
      !loading &&
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedHomeId,
    remoteDefaultHomeId,
    loading,
    homes?.length, // Use primitive to prevent re-runs when array reference changes
    setDefaultHomeMutation,
    // handleApolloError removed - it's a static method, no need to track
    setSelectedHomeId,
  ]);

  // CRUD operations utilities
  const { createAddOperation, createRemoveOperation } = useCrudOperations();

  const [createHomeMutation, { loading: creating, client }] =
    useCreateHomeMutation({
      errorPolicy: 'all',
      // Note: No optimisticResponse - the mutation returns complex nested types that are difficult to predict:
      // - Home object with 20+ fields (members, myMembership, pantries, membershipStats, etc.)
      // - Nested objects like default pantry (if createDefaultPantry=true)
      // - Server-generated IDs, timestamps, and computed fields
      // Creating accurate optimistic response would require duplicating complex server logic
      // Instead, cache update provides feedback within ~100-200ms which is acceptable UX
      // (See docs/apollo-client-patterns.md - acceptable to skip optimistic response for complex creates)
      // Update cache using generic utility
      update: (cache, { data }) => {
        if (!data?.createHome) return;

        try {
          addToHomesCache(cache, data.createHome, { position: 'end' });
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
          const normalizedNewHome = normalizeHome(newHome);
          if (normalizedNewHome?.pantries?.length) {
            const defaultPantry = normalizedNewHome.pantries.find(
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
    errorPolicy: 'all',
    // Uses automatic normalization - mutation returns full Home fragment
    // No manual cache update needed (Pattern 2)
    optimisticResponse: (variables, { IGNORE }) => {
      const currentHome = homes?.find((h: any) => h.id === variables.id);
      if (!currentHome) return IGNORE;

      return {
        __typename: 'Mutation',
        updateHome: enhanceWithVersion(currentHome as any, variables.input),
      };
    },
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
      // Update cache using generic utility
      update: (cache, { data }, { variables }) => {
        if (!data?.deleteHome || !variables) return;

        try {
          const deletedHomeId = variables.id;
          removeFromHomesCache(cache, deletedHomeId, { evictItem: true });
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
              // Clear orphaned pantry selection - useDefaultHome will auto-select new home's default
              setSelectedPantryId(null);
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
              // No homes left, clear all selections
              setSelectedHomeId(null);
              setSelectedPantryId(null);
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
    errorPolicy: 'all',
    // Note: No cache update or optimistic response needed
    // The cache update returns existingMembers unchanged because:
    // 1. Invites don't immediately add members (requires acceptance)
    // 2. Real-time subscription handles all updates when invite is sent/accepted
    // 3. This pattern avoids UI flickering from optimistic updates that may not match server state
    // Following subscription-based update pattern for real-time features (see docs/apollo-client-patterns.md)
    update: (cache, { data }, { variables }) => {
      if (!data?.inviteToHome || !variables) return;

      try {
        const homeId = variables.input.homeId;

        // Empty cache.modify - subscription handles the actual update
        if (data.inviteToHome) {
          cache.modify({
            id: cache.identify({ __typename: 'Home', id: homeId }),
            fields: {
              members(existingMembers = []) {
                // Return unchanged - subscription will handle the update when invite is accepted
                return existingMembers;
              },
            },
          });
        }
      } catch (error) {
        console.warn('Cache update failed for inviteUser:', error);
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
      errorPolicy: 'all',
      // Note: No optimistic response or manual cache update
      // The mutation returns only Membership data (not the full Home object)
      // We refetch GetHomesQuery to get the complete home with all fields (members, pantries, etc.)
      // This is acceptable because join-home is an infrequent action (~100-200ms refetch time)
      // Alternative approach would require a subscription or separate query for the joined home
      update: (_cache, { data }) => {
        if (!data?.joinHomeByCode) return;

        try {
          // Refetch homes list to get the newly joined home with all fields
          refetch();
        } catch (error) {
          console.warn('Failed to refetch homes after join:', error);
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
      fetchPolicy: 'network-only', // Always fetch fresh data (one-time operation)
    });

  // Get default pantry for a home
  const [getDefaultPantry] = useGetDefaultPantryLazyQuery({
    fetchPolicy: 'network-only', // Always fetch fresh default pantry (one-time operation)
  });

  // Helper functions using CRUD utilities
  const createHomeOperation = createAddOperation({
    mutation: createHomeMutation,
    transformInput: (input: { name: string; createDefaultPantry?: boolean; allowJoinCode?: boolean }) => ({
      name: input.name.trim(),
      createDefaultPantry: input.createDefaultPantry ?? true,
      allowJoinCode: input.allowJoinCode ?? true,
    }),
    validateInput: (input: { name: string }) => {
      if (!input.name?.trim()) {
        return 'Please enter a home name';
      }
      return true;
    },
    onSuccess: (data: any) => data?.createHome,
    operationName: 'Create Home',
  });

  // Wrapper to support both string and object signatures
  const createHome = async (
    nameOrInput: string | { name: string; createDefaultPantry?: boolean; allowJoinCode?: boolean },
  ) => {
    const input =
      typeof nameOrInput === 'string'
        ? { name: nameOrInput, createDefaultPantry: true, allowJoinCode: true }
        : nameOrInput;
    return createHomeOperation(input);
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

  const deleteHome = (homeId: string, homeName: string) => {
    const operation = createRemoveOperation({
      mutation: deleteHomeMutation,
      itemId: homeId,
      confirmMessage: 'Are you sure you want to delete "{name}"?',
      itemName: homeName,
      operationName: 'Delete Home',
    });
    return operation();
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
      // Call mutation first to update backend and Apollo cache
      const result = await setDefaultHomeMutation({
        variables: { homeId },
      });

      if (result.data) {
        // Immediately update local state for instant UI feedback
        setSelectedHomeId(homeId);

        // Auto-select the default pantry using server query
        try {
          const { data: pantryData } = await getDefaultPantry({
            variables: { homeId },
          });

          if (pantryData?.defaultPantry?.id) {
            setSelectedPantryId(pantryData.defaultPantry.id);
          }
        } catch (error) {
          console.warn('Failed to get default pantry:', error);
          // Non-critical - user can manually select pantry if needed
        }

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
    await refetch();
  }, [refetch]);

  return {
    // Data
    homes,
    allHomes: homes,
    defaultHome,
    defaultHomeId: selectedHomeId,
    remoteDefaultHomeId,
    isSynced,
    loading,
    initialLoading: !homes && loading,
    error,
    stats,
    previewHome: previewData?.homeByJoinCode ? normalizeHome(previewData.homeByJoinCode) : null,

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
