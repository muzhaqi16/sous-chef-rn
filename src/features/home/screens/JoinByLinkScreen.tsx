import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import type { StaticScreenProps } from '@react-navigation/native';
import { ErrorState } from '#components/molecules/ErrorState';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
import { useResolveShareLink } from '#features/home/hooks/useResolveShareLink';
import { ShareLinkTargetType } from '#/graphql/generated/schemaTypes';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { SubScreen } from '#components/templates/SubScreen';

/**
 * Entry point for a link whose type is unknown up front (`join/:code`):
 * `resolveShareLink` identifies it, then this `replace`s itself with the
 * matching join screen, which owns preview, auth gate and mutation.
 * `resolveShareLink` is `@optionalAuth`, so it works while logged out.
 */
export const JoinByLinkScreen: React.FC<
  StaticScreenProps<{ code?: string } | undefined>
> = ({ route }) => {
  const { t } = useTranslation();
  const { goBack, replaceWithJoinHomeByCode, replaceWithJoinByShareCode } =
    useAppNavigation();
  const code = route.params?.code ?? '';

  const { link: result, loading } = useResolveShareLink(code);

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
    switch (result.targetType) {
      case ShareLinkTargetType.HomeJoin:
        replaceWithJoinHomeByCode(code);
        break;
      case ShareLinkTargetType.ListJoin:
        replaceWithJoinByShareCode(code);
        break;
    }
  }, [result, code, replaceWithJoinHomeByCode, replaceWithJoinByShareCode]);

  // Code resolved to nothing — invalid or expired.
  const invalid = !!code && !loading && !result;

  return (
    <SubScreen title={t('joinLink.title')} scroll="none">
      {invalid ? (
        <ErrorState
          icon="alert-circle-outline"
          title={t('joinLink.invalidTitle')}
          message={t('joinLink.invalidDescription')}
          severity="error"
          alignment="center"
          secondaryAction={{
            label: t('labels.goBack'),
            onPress: goBack,
          }}
        />
      ) : (
        <View style={styles.loader}>
          <SousChefLoader size="small" showBrand={false} />
        </View>
      )}
    </SubScreen>
  );
};

export default JoinByLinkScreen;

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
