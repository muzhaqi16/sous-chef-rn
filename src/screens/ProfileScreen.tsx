import React, {useEffect} from 'react';
import {
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
  Text,
  Image,
} from 'react-native';
import FeatherIcon from '@react-native-vector-icons/feather';
import MaterialCommunityIcon from '@react-native-vector-icons/material-icons';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {useStore} from '../store/useStore';
import {Section, RowProps} from '../components/organisms/ProfileInfo';

export default function ProfileScreen() {
  const {styles, theme} = useStyles(stylesheet);
  // Select each piece of state separately to avoid signature issues
  const user = useStore(s => s.user);
  const firstName = useStore(s => s.firstName);
  const lastName = useStore(s => s.lastName);
  const avatarUrl = useStore(s => s.avatarUrl);
  const phone = useStore(s => s.phone);
  const dateOfBirth = useStore(s => s.dateOfBirth);
  const updateProfile = useStore(s => s.updateProfile);
  const getUserProfile = useStore(s => s.getUserProfile);

  useEffect(() => {
    getUserProfile(); // Fetch user profile on mount
  }, [getUserProfile]);
  // Fetch user profile on mount

  // Helper to build save handlers; field is now any for flexibility
  const makeSaveHandler = (field: any) => async (val: string) => {
    const err = await updateProfile({[field]: val});
    if (err) console.warn(`Failed to update ${field}:`, err);
  };
  const personalRows: RowProps[] = [
    {
      label: 'First Name',
      value: firstName || '',
      onSave: makeSaveHandler('firstName'),
      leadingIcon: (
        <FeatherIcon name="user" size={20} color={theme.colors.textPrimary} />
      ),
    },
    {
      label: 'Last Name',
      value: lastName || '',
      onSave: makeSaveHandler('lastName'),
      leadingIcon: (
        <FeatherIcon name="edit" size={20} color={theme.colors.textPrimary} />
      ),
    },
    {
      label: 'Phone',
      value: phone || '',
      onSave: makeSaveHandler('phone'),
      leadingIcon: (
        <FeatherIcon name="phone" size={20} color={theme.colors.textPrimary} />
      ),
    },
    {
      label: 'Birthday',
      value: dateOfBirth || '',
      onSave: makeSaveHandler('dateOfBirth'),
      leadingIcon: (
        <FeatherIcon
          name="calendar"
          size={20}
          color={theme.colors.textPrimary}
        />
      ),
    },
  ];

  const socialRows: RowProps[] = [
    {
      label: 'Apple',
      leadingIcon: (
        <MaterialCommunityIcon
          name="apple"
          size={20}
          color={theme.colors.textPrimary}
        />
      ),
      value: user?.appleConnected ? 'Connected' : 'Connect',
      badgeColor: user?.appleConnected
        ? theme.colors.primary
        : theme.colors.textSecondary,
      onPress: () => {
        /* toggle Apple */
      },
    },
    {
      label: 'Discord',
      leadingIcon: (
        <MaterialCommunityIcon
          name="discord"
          size={20}
          color={theme.colors.textPrimary}
        />
      ),
      value: user?.discordConnected ? 'Connected' : 'Connect',
      badgeColor: user?.discordConnected
        ? theme.colors.primary
        : theme.colors.textSecondary,
      onPress: () => {
        /* toggle Discord */
      },
    },
    {
      label: 'Facebook',
      leadingIcon: (
        <MaterialCommunityIcon
          name="facebook"
          size={20}
          color={theme.colors.textPrimary}
        />
      ),
      value: user?.facebookVerified ? 'Verified' : 'Verify',
      badgeColor: user?.facebookVerified
        ? theme.colors.success
        : theme.colors.error,
      onPress: () => {
        /* verify Facebook */
      },
    },
  ];

  const loginRows: RowProps[] = [
    {
      label: 'Email',
      value: user?.email || '',
      onSave: makeSaveHandler('email'),
    },
    {
      label: 'Password',
      onPress: () => {
        /* navigate to change password */
      },
    },
  ];
  console.log('ProfileScreen rendered with user:', user);
  console.log('Avatar URL:', avatarUrl);
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            /* back */
          }}>
          <FeatherIcon
            name="arrow-left"
            size={24}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            /* more */
          }}>
          <FeatherIcon
            name="more-vertical"
            size={24}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{uri: avatarUrl}} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <FeatherIcon
                name="user"
                size={32}
                color={theme.colors.textSecondary}
              />
            </View>
          )}
          <TouchableOpacity
            style={styles.avatarIcon}
            onPress={() => {
              /* change avatar */
            }}>
            <FeatherIcon
              name="camera"
              size={16}
              color={theme.colors.onPrimary}
            />
          </TouchableOpacity>
        </View>

        <Section title="Personal Information" rows={personalRows} />
        <Section title="Login Information" rows={loginRows} />
        <Section title="Social Accounts" rows={socialRows} />
        {/* Log out */}
        <TouchableOpacity
          style={styles.logOutButton}
          onPress={() => {
            /* log out */
          }}>
          <Text style={styles.logOutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const stylesheet = createStyleSheet(theme => ({
  container: {flex: 1, backgroundColor: theme.colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  content: {paddingHorizontal: 24, paddingBottom: 32},
  avatarContainer: {alignItems: 'center', marginVertical: 24},
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
  },
  avatarIcon: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    padding: 4,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logOutButton: {
    marginTop: 32,
    padding: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
  },
  logOutText: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.size.xl,
    fontWeight: '600',
  },
}));
