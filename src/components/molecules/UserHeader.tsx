import React from 'react';
import {View, Text, TouchableOpacity, Image} from 'react-native';
import FeatherIcon from '@react-native-vector-icons/feather';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {useNavigation} from '@react-navigation/native';
import {useStore} from '../../store';

export const UserHeader: React.FC = () => {
  const {styles, theme} = useStyles(stylesheet);
  const navigation = useNavigation();
  const {user} = useStore();
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>
        Hello <Text style={{fontWeight: 'bold'}}>Tani</Text>
      </Text>

      <View style={styles.headerActions}>
        {/* Notifications */}
        <TouchableOpacity
          onPress={() => {
            navigation.navigate('NotificationStack', {
              screen: 'NotificationList',
            });
          }}>
          <View style={styles.headerNotifications}>
            <FeatherIcon color="#222" name="bell" size={20} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            // handle onPress
          }}>
          <View style={styles.avatar}>
            <Image
              alt=""
              source={{
                uri: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2.5&w=256&h=256&q=80',
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

const stylesheet = createStyleSheet(theme => ({
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
