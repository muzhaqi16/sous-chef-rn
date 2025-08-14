import {useMemo} from 'react';
import {Alert} from 'react-native';
import {
  useGetHomesQuery,
  useCreateHomeMutation,
  useUpdateHomeMutation,
  useDeleteHomeMutation,
  useInviteUserToHomeMutation,
  GetHomesQuery,
  GetHomesDocument,
  MembershipRole,
} from '#generated';
import {useSearchableList} from '../useSearchableList';
import {useStore} from '#store';

export function useHomeManagement() {
  const {setSelectedHomeId} = useStore();

  const {data, loading, error, refetch} = useGetHomesQuery({
    fetchPolicy: 'cache-and-network',
  });

  const homes = data?.homes || [];

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
        }
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to delete home');
      console.error('Delete home error:', error);
    },
  });

  // Invite user to home mutation
  const [inviteUserMutation, {loading: inviting}] = useInviteUserToHomeMutation(
    {
      onError: error => {
        Alert.alert('Error', 'Failed to send invitation');
        console.error('Invite user error:', error);
      },
    },
  );

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
      return false;
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
      setSelectedHomeId(homeId);
      // Optionally update the home in the database to mark as default
      // await updateHome(homeId, { isDefault: true });
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to set default home');
      return false;
    }
  };

  const inviteUserToHome = async (
    homeId: string,
    email: string,
    role: MembershipRole = MembershipRole.Member,
  ) => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return false;
    }

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

  const inviteUserPrompt = (homeId: string) => {
    Alert.prompt(
      'Invite Member',
      'Enter email address',
      async email => {
        if (email) {
          await inviteUserToHome(homeId, email);
        }
      },
      'plain-text',
      '',
      'email-address',
    );
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

  return {
    // Data
    homes: filtered,
    allHomes: homes,
    loading,
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
    inviteUserPrompt,
    refetch,
  };
}
