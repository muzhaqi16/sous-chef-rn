import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { StaticScreenProps } from '@react-navigation/native';
import { useMutation, useQuery } from '@apollo/client/react';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { Header } from '#components/molecules/Header';
import { Button } from '#components/base/Button';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';
import { ErrorState } from '#components/base/ErrorState';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import {
  GetHomeByJoinCodeDocument,
  JoinHomeByCodeDocument,
} from '#operations/home/home.generated';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useJoinLinkAuthGate } from '#hooks/deepLink/useJoinLinkAuthGate';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';
import {
  executeWithLoadingState,
  unwrapPayload,
} from '#/utils/compilerSafeWrappers';

/**
 * Join a home/pantry via a share link (`join-home/:joinCode`) or by typing a
 * join code manually. Mirrors {@link JoinByShareCodeScreen} for shopping lists
 * but adds a preview-then-confirm step: `GetHomeByJoinCode` resolves the home
 * name + member/pantry counts so the user sees what they're joining before
 * committing with `JoinHomeByCode`.
 */
export const JoinHomeByCodeScreen: React.FC<
  StaticScreenProps<{ joinCode?: string }>
> = ({ route }) => {
  const { t } = useTranslation();
  const { goBack } = useNavigation();
  const { toPantryMain } = useAppNavigation();
  const initialCode = route.params?.joinCode ?? '';

  // Joining requires auth — queue the code and redirect to sign-in when logged
  // out (replayed after login by useDeepLinkRouter).
  const isLoggedOut = useJoinLinkAuthGate('join_home', initialCode);

  // `code` is the code we're previewing/joining; `inputValue` is the editable
  // field. They diverge while the user types a new code before tapping "Find".
  const [code, setCode] = useState(initialCode);
  const [inputValue, setInputValue] = useState(initialCode);
  const [joining, setJoining] = useState(false);

  const { data, loading: previewLoading } = useQuery(
    GetHomeByJoinCodeDocument,
    {
      variables: { joinCode: code },
      skip: !code || isLoggedOut,
      fetchPolicy: 'cache-and-network',
    },
  );
  const home = data?.homeByJoinCode ?? null;

  const { requireVerifiedEmail } = useVerifiedEmailGate();
  const [joinMutation] = useMutation(JoinHomeByCodeDocument);

  const handleFind = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      toastService.error(t('joinHome.emptyCodeError'));
      return;
    }
    setCode(trimmed);
  };

  const handleUseDifferentCode = () => {
    setCode('');
  };

  const handleJoin = () => {
    if (!code) {
      return;
    }
    if (!requireVerifiedEmail()) return;

    executeWithLoadingState(
      async () => {
        const { data: joinData } = await joinMutation({
          variables: { input: { joinCode: code } },
        });

        const result = unwrapPayload(
          joinData?.joinHomeByCode,
          'JoinHomeByCodePayload',
          t('joinHome.joinFailed'),
        );

        useStore.getState().setSelectedHomeId(result.membership.homeId);
        goBack();
        toPantryMain();
        toastService.success(
          t('joinHome.joinedToast', {
            name: home?.name || t('joinHome.homeFallback'),
          }),
        );
      },
      setJoining,
      () => {
        toastService.error(t('joinHome.joinFailed'));
      },
    );
  };

  const renderBody = () => {
    // Redirecting to sign-in, or resolving the preview for the chosen code.
    if (isLoggedOut || (!!code && previewLoading && !home)) {
      return (
        <View style={styles.loader}>
          <SousChefLoader size="small" showBrand={false} />
        </View>
      );
    }

    // Manual-entry state — no code chosen yet.
    if (!code) {
      return (
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Icon name="home-outline" size={48} tone="primary" />
          </View>
          <Text size="lg" weight="semibold" align="center" style={styles.title}>
            {t('joinHome.enterCodeTitle')}
          </Text>
          <Text
            size="md"
            tone="secondary"
            align="center"
            style={styles.description}
          >
            {t('joinHome.enterCodeDescription')}
          </Text>
          <BaseInput
            containerStyle={styles.inputContainer}
            style={styles.inputText}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder={t('joinHome.codePlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            title={t('joinHome.findHome')}
            onPress={handleFind}
            disabled={!inputValue.trim()}
            style={styles.actionButton}
          />
        </View>
      );
    }

    // Code entered but no home matched it.
    if (!home) {
      return (
        <ErrorState
          icon="alert-circle-outline"
          title={t('joinHome.notFoundTitle')}
          message={t('joinHome.notFoundDescription')}
          severity="error"
          alignment="center"
          onRetry={handleUseDifferentCode}
          retryLabel={t('joinHome.tryDifferentCode')}
        />
      );
    }

    // Preview-then-confirm (home is non-null here).
    const memberCount = home.membersConnection.totalCount ?? 0;
    const pantryCount = home.pantriesConnection.totalCount ?? 0;
    return (
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon name="home" size={48} tone="primary" />
        </View>
        <Text size="md" tone="secondary" align="center" style={styles.title}>
          {t('joinHome.invitedToJoin')}
        </Text>
        <View style={styles.previewCard}>
          <Text size="lg" weight="semibold" align="center">
            {home.name}
          </Text>
          <Text size="sm" tone="secondary" align="center" style={styles.meta}>
            {t('joinHome.memberCount', { count: memberCount })} ·{' '}
            {t('joinHome.pantryCount', { count: pantryCount })}
          </Text>
        </View>
        <Button
          title={t('joinHome.joinButton')}
          onPress={handleJoin}
          loading={joining}
          style={styles.actionButton}
        />
        <Button
          title={t('joinHome.enterDifferentCode')}
          variant="ghost"
          onPress={handleUseDifferentCode}
          disabled={joining}
          style={styles.secondaryButton}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header title={t('joinHome.title')} onBack={() => goBack()} centerTitle />
      {renderBody()}
    </View>
  );
};

export default JoinHomeByCodeScreen;

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
  previewCard: {
    width: '100%',
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  meta: {
    marginTop: theme.spacing.xs,
  },
  actionButton: {
    width: '100%',
  },
  secondaryButton: {
    width: '100%',
    marginTop: theme.spacing.sm,
  },
}));
