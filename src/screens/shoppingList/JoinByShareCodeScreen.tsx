import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useNavigation } from '@react-navigation/native';
import type { StaticScreenProps } from '@react-navigation/native';
import { Header } from '#components/molecules/Header';
import { Button } from '#components/base/Button';
import { Icon } from '#utils/iconUtils';
import { useJoinShoppingListByShareCodeMutation } from '#generated';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

export const JoinByShareCodeScreen: React.FC<
  StaticScreenProps<{ shareCode?: string }>
> = ({ route }) => {
  const navigation = useNavigation();
  const { navigate } = useAppNavigation();
  const initialCode = route.params?.shareCode ?? '';

  const [code, setCode] = useState(initialCode);
  const [joining, setJoining] = useState(false);

  const [joinMutation] = useJoinShoppingListByShareCodeMutation();

  const handleJoin = () => {
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter a share code');
      return;
    }

    executeWithLoadingState(
      async () => {
        const { data } = await joinMutation({
          variables: { shareCode: trimmed },
        });

        const listId = data?.joinShoppingListByShareCode?.shoppingList?.id;
        const listName = data?.joinShoppingListByShareCode?.shoppingList?.name;

        if (listId) {
          Alert.alert(
            'Joined!',
            `You have joined "${listName || 'Shopping List'}".`,
            [
              {
                text: 'View List',
                onPress: () => {
                  navigation.goBack();
                  navigate('ShoppingListMain', {});
                },
              },
            ],
          );
        }
      },
      setJoining,
      () => {
        Alert.alert('Error', 'Failed to join list. The code may be invalid or expired.');
      },
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Join Shopping List" onBack={() => navigation.goBack()} centerTitle />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon name="link-outline" size={48} color="#6366f1" />
        </View>

        <Text style={styles.title}>Enter Share Code</Text>
        <Text style={styles.description}>
          Enter the share code you received to join a shopping list.
        </Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Enter share code"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!joining}
        />

        <Button
          title={joining ? '' : 'Join List'}
          onPress={handleJoin}
          disabled={joining || !code.trim()}
          style={styles.joinButton}
        >
          {joining ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            'Join List'
          )}
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: theme.typography.fontSize.md * 1.5,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: theme.spacing.lg,
  },
  joinButton: {
    width: '100%',
  },
}));
