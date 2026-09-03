import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';

import type { StaticScreenProps } from '@react-navigation/native';
import { Header } from '#components/molecules/Header';
import { Button } from '#components/atoms/Button';
import { Icon } from '#utils/iconUtils';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
import { useJoinShoppingListByShareCode } from '#features/shoppingList/hooks/useJoinShoppingListByShareCode';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useJoinLinkAuthGate } from '#hooks/deepLink/useJoinLinkAuthGate';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { unwrapPayload } from '#/utils/errors/mutationPayload';
import { Text } from '#components/atoms/Text';

export const JoinByShareCodeScreen: React.FC<
  StaticScreenProps<{ shareCode?: string }>
> = ({ route }) => {
  const { t } = useTranslation();
  const { goBack, toShoppingListMain } = useAppNavigation();
  const initialCode = route.params?.shareCode ?? '';

  // Joining requires auth — queue the code and redirect to sign-in when logged
  // out (replayed after login by useDeepLinkRouter).
  const isLoggedOut = useJoinLinkAuthGate('join_list', initialCode);

  const [code, setCode] = useState(initialCode);
  const [joining, setJoining] = useState(false);

  const { requireVerifiedEmail } = useVerifiedEmailGate();
  const { joinByShareCode } = useJoinShoppingListByShareCode();

  const handleJoin = () => {
    if (!requireVerifiedEmail()) return;

    const trimmed = code.trim();
    if (!trimmed) {
      toastService.error(t('shoppingListScreens.joinEmptyCodeError'));
      return;
    }

    executeWithLoadingState(
      async () => {
        const result = unwrapPayload(
          await joinByShareCode(trimmed),
          'JoinShoppingListByShareCodePayload',
          t('shoppingListScreens.joinFailed'),
        );

        useStore.getState().setSelectedShoppingListId(result.shoppingList.id);
        goBack();
        toShoppingListMain();
        toastService.success(
          t('labels.joined', {
            name: result.shoppingList.name || t('labels.shoppingList'),
          }),
        );
      },
      setJoining,
      () => {
        toastService.error(t('shoppingListScreens.joinFailed'));
      },
    );
  };

  if (isLoggedOut) {
    return (
      <View style={styles.container}>
        <Header
          title={t('shoppingListScreens.joinTitle')}
          onBack={() => goBack()}
          centerTitle
        />
        <View style={styles.loader}>
          <SousChefLoader size="small" showBrand={false} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={t('shoppingListScreens.joinTitle')}
        onBack={() => goBack()}
        centerTitle
      />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon name="link-outline" size={48} tone="primary" />
        </View>

        <Text size="lg" weight="semibold" align="center" style={styles.title}>
          {t('shoppingListScreens.joinEnterCodeTitle')}
        </Text>
        <Text
          size="md"
          tone="secondary"
          align="center"
          style={styles.description}
        >
          {t('shoppingListScreens.joinEnterCodeDescription')}
        </Text>

        <BaseInput
          containerStyle={styles.inputContainer}
          style={styles.inputText}
          value={code}
          onChangeText={setCode}
          placeholder={t('shoppingListScreens.joinCodePlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!joining}
        />

        <Button
          title={t('shoppingListScreens.joinButton')}
          onPress={handleJoin}
          loading={joining}
          disabled={!code.trim()}
          style={styles.joinButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: theme.spacing.sm,
  },
  description: {
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
