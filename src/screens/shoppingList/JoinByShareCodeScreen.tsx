import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { useNavigation } from '@react-navigation/native';
import type { StaticScreenProps } from '@react-navigation/native';
import { Header } from '#components/molecules/Header';
import { Button } from '#components/base/Button';
import { Icon } from '#utils/iconUtils';
import { useJoinShoppingListByShareCodeMutation } from '#generated';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';
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
      toastService.error('Please enter a share code');
      return;
    }

    executeWithLoadingState(
      async () => {
        const { data } = await joinMutation({
          variables: { shareCode: trimmed },
        });

        const result = data?.joinShoppingListByShareCode;
        const listId = result?.shoppingList?.id;
        const listName = result?.shoppingList?.name;

        if (!result?.success || !listId) {
          toastService.error(
            result?.message ||
              'Failed to join list. The code may be invalid or expired.',
          );
          return;
        }

        useStore.getState().setSelectedShoppingListId(listId);
        navigation.goBack();
        navigate('ShoppingListMain', {});
        toastService.success(`Joined "${listName || 'Shopping List'}"`);
      },
      setJoining,
      () => {
        toastService.error(
          'Failed to join list. The code may be invalid or expired.',
        );
      },
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Join Shopping List"
        onBack={() => navigation.goBack()}
        centerTitle
      />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon name="link-outline" size={48} color="#6366f1" />
        </View>

        <Text style={styles.title}>Enter Share Code</Text>
        <Text style={styles.description}>
          Enter the share code you received to join a shopping list.
        </Text>

        <BaseInput
          containerStyle={styles.inputContainer}
          style={styles.inputText}
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
  inputContainer: {
    width: '100%',
    marginBottom: theme.spacing.lg,
  },
  inputText: {
    textAlign: 'center',
    letterSpacing: 2,
    fontSize: theme.typography.fontSize.lg,
  },
  joinButton: {
    width: '100%',
  },
}));
