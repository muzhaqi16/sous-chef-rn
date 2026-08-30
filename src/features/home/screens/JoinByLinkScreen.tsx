import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { StaticScreenProps } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { Header } from '#components/molecules/Header';
import { ErrorState } from '#components/atoms/ErrorState';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
import { ResolveShareLinkDocument } from '#features/home/screens/JoinByLinkScreen.generated';
import { ShareLinkTargetType } from '#/graphql/generated/schemaTypes';

/**
 * Entry point for a link whose type is unknown up front (`join/:code`):
 * `resolveShareLink` identifies it, then this `replace`s itself with the
 * matching join screen, which owns preview, auth gate and mutation.
 * `resolveShareLink` is `@optionalAuth`, so it works while logged out.
 */
export const JoinByLinkScreen: React.FC<
  StaticScreenProps<{ code?: string }>
> = ({ route }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const code = route.params?.code ?? '';

  const { data, loading } = useQuery(ResolveShareLinkDocument, {
    variables: { code },
    skip: !code,
    fetchPolicy: 'cache-and-network',
  });
  const result = data?.resolveShareLink ?? null;

  // Guard against double-dispatch if `result` re-emits (cache→network) before
  // this screen unmounts. A ref (mutated only in the effect, never read during
  // render) avoids a setState-in-effect cascade.
  const routedRef = useRef(false);

  useEffect(() => {
    if (!result || routedRef.current) {
      return;
    }
    routedRef.current = true;
    // `replace` (not navigate): this screen is a transparent resolver and must
    // not linger in the back stack once it routes to the per-type join screen.
    if (result.targetType === ShareLinkTargetType.HomeJoin) {
      navigation.dispatch(
        StackActions.replace('JoinHomeByCode', { joinCode: code }),
      );
    } else if (result.targetType === ShareLinkTargetType.ListJoin) {
      navigation.dispatch(
        StackActions.replace('JoinByShareCode', { shareCode: code }),
      );
    }
  }, [result, code, navigation]);

  // Code resolved to nothing — invalid or expired.
  const invalid = !!code && !loading && !result;

  return (
    <View style={styles.container}>
      <Header
        title={t('joinLink.title')}
        onBack={() => navigation.goBack()}
        centerTitle
      />
      {invalid ? (
        <ErrorState
          icon="alert-circle-outline"
          title={t('joinLink.invalidTitle')}
          message={t('joinLink.invalidDescription')}
          severity="error"
          alignment="center"
          secondaryAction={{
            label: t('labels.goBack'),
            onPress: () => navigation.goBack(),
          }}
        />
      ) : (
        <View style={styles.loader}>
          <SousChefLoader size="small" showBrand={false} />
        </View>
      )}
    </View>
  );
};

export default JoinByLinkScreen;

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
}));
