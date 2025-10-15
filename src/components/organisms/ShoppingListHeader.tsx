import React from 'react';
import {View, Text, Image} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {useGetUserProfileQuery} from '../../graphql/generated';

const ShoppingListHeader: React.FC = ({}) => {
  const {theme} = useUnistyles();
  // Fetch the user's avatar URL from the query
  const {data: userProfileData} = useGetUserProfileQuery({
    fetchPolicy: 'cache-and-network',
    onError: error => console.error('Error fetching user profile:', error),
  });
  // Use the avatar URL from the user profile data
  // Fallback to a placeholder if the avatar URL is not available
  const avatarUrl =
    userProfileData?.userProfile?.avatar || 'https://via.placeholder.com/40';

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>PANT</Text>
        <Text style={[styles.title, {color: theme.colors.primary}]}>RY</Text>
      </View>
      {/* Placeholder avatar; replace with actual user image */}
      <Image
        style={styles.avatar}
        source={{
          uri: avatarUrl || 'https://via.placeholder.com/40',
        }}
      />
    </View>
  );
};
const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
}));

export default ShoppingListHeader;
