import React from 'react';
import {View, Text, TouchableOpacity, Image} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useNavigation} from '@react-navigation/native';
import {useProfileData} from '#/hooks';

export const UserHeader: React.FC = () => {
  const navigation = useNavigation();
  const {profile} = useProfileData();
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>
        Hello <Text style={{fontWeight: 'bold'}}>Tani</Text>
      </Text>

      <View style={styles.headerActions}>
        <TouchableOpacity
          onPress={() => {
            navigation.navigate('NotificationStack', {
              screen: 'NotificationList',
            });
          }}>
          <View style={styles.avatar}>
            <Image
              alt=""
              source={{
                uri: profile?.avatar || 'https://via.placeholder.com/150',
              }}
              style={styles.avatarImg}
            />

            <View style={styles.avatarNotification} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  /** Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: theme.spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '400',
    color: '#222',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerNotifications: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Avatar */
  avatar: {
    position: 'relative',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 9999,
  },
  avatarNotification: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: '#fff',
    top: 0,
    right: -2,
    width: 14,
    height: 14,
    backgroundColor: '#f77171',
  },
}));
