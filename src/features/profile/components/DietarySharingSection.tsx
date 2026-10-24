import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { SettingSwitch } from '#components/molecules/SettingSwitch';
import type { DietarySharingHome } from '#features/profile/hooks/useDietarySharing';
import { profileTestIDs } from '#features/profile/testIDs';

interface DietarySharingSectionProps {
  homes: DietarySharingHome[];
  onChange: (homeId: string, shared: boolean) => Promise<void>;
}

/** One switch per home deciding whether it sees the caller's restrictions. */
export const DietarySharingSection: React.FC<DietarySharingSectionProps> = ({
  homes,
  onChange,
}) => {
  const { t } = useTranslation();
  const sharesAny = homes.some(home => home.shared);

  return (
    <>
      <Text role="caption" tone="secondary" style={styles.hint}>
        {sharesAny ? t('dietary.sharedWithShown') : t('dietary.sharedWithNone')}
      </Text>
      {homes.map(home => (
        <SettingSwitch
          key={home.id}
          title={home.name}
          value={home.shared}
          onValueChange={shared => onChange(home.id, shared)}
          testID={profileTestIDs.dietarySharingSwitch(home.id)}
        />
      ))}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  hint: {
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
}));
