import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { shareUrl } from '#native/share';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useHouseholdInvite } from '#features/onboarding/hooks/useHouseholdInvite';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { StoresOffer } from './StoresOffer';

/** Invites the people the user shares meals with to their home, by its join link. */
const InviteHousehold = ({ homeId }: { homeId: string }) => {
  const { t } = useTranslation();
  const { requireVerifiedEmail } = useVerifiedEmailGate();
  const { inviteLink } = useHouseholdInvite(homeId);
  const [sharing, setSharing] = useState(false);
  const [failed, setFailed] = useState(false);

  const invite = async () => {
    if (!requireVerifiedEmail()) return;
    setSharing(true);
    setFailed(false);
    const url = await inviteLink();
    setSharing(false);
    if (url) await shareUrl(url, t('homeDetail.shareLinkMessage'));
    else setFailed(true);
  };

  return (
    <View style={styles.invite}>
      <Button
        title={t('onBoarding.inviteHousehold')}
        icon="person-add-outline"
        onPress={() => {
          void invite();
        }}
        variant="outline"
        loading={sharing}
        testID={onboardingTestIDs.invite}
      />
      {failed ? (
        <Text role="error" tone="error" align="center">
          {t('onBoarding.inviteFailed')}
        </Text>
      ) : null}
    </View>
  );
};

/**
 * What the user can do next for their home: invite the others at the table,
 * and pick the stores they shop at.
 */
export const OnboardingOffers = ({
  homeId,
  cooksFor,
}: {
  homeId: string | null;
  cooksFor: number | null;
}) => {
  const apiUnavailable = useIsApiUnavailable();
  if (!homeId) return null;
  return (
    <>
      {cooksFor !== null && cooksFor > 1 ? (
        <InviteHousehold homeId={homeId} />
      ) : null}
      {/* Finding stores needs the API. */}
      {apiUnavailable ? null : <StoresOffer homeId={homeId} />}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  invite: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
}));
