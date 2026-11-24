import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { SEVERITY_LABEL_KEYS } from '#domain/dietary';
import { RestrictionSeverity } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { Sheet } from '#components/templates/Sheet';
import { profileTestIDs } from '#features/profile/testIDs';
import { commonStyles } from '#/styles/commonStyles';
import { AvoidFoodSearch } from '#features/profile/ui/AvoidFoodSearch';
import { useOpening } from '#hooks/ui/useOpening';

/** Mildest first: avoiding a food is the common case, so it leads. */
const SEVERITIES: RestrictionSeverity[] = [
  RestrictionSeverity.Preference,
  RestrictionSeverity.Intolerance,
  RestrictionSeverity.Allergy,
];

interface AvoidFoodSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Item ids already avoided, which the suggestions leave out. */
  avoided?: ReadonlySet<string>;
  /** Resolves whether the food was added; the sheet closes only when it was. */
  onPick: (
    food: { id: string; name: string },
    severity: RestrictionSeverity,
  ) => Promise<boolean>;
}

type AvoidFoodContentProps = Omit<AvoidFoodSheetProps, 'visible'> & {
  active: boolean;
};

/** One opening: the severity starts at the mildest. */
const AvoidFoodContent: React.FC<AvoidFoodContentProps> = ({
  active,
  onDismiss,
  avoided,
  onPick,
}) => {
  const { t } = useTranslation();
  const [severity, setSeverity] = useState(RestrictionSeverity.Preference);
  const [saving, setSaving] = useState(false);

  const handlePick = async (food: { id: string; name: string }) => {
    if (saving) return;
    setSaving(true);
    const added = await onPick(food, severity);
    setSaving(false);
    if (added) onDismiss();
  };

  return (
    <View testID={profileTestIDs.avoidSheet}>
      <Text role="body" tone="secondary" style={styles.spaced}>
        {t('dietaryProfile.avoidHint')}
      </Text>
      <View style={styles.spaced}>
        <SegmentedControl
          options={SEVERITIES}
          value={severity}
          onChange={setSeverity}
          formatLabel={option => {
            const key = SEVERITY_LABEL_KEYS[option];
            return key ? t(key) : t('labels.unknown');
          }}
          testID={profileTestIDs.avoidSeverity}
        />
      </View>
      <AvoidFoodSearch
        active={active}
        avoided={avoided}
        onPick={food => {
          void handlePick(food);
        }}
      />
    </View>
  );
};

/**
 * Picks a catalog food to avoid, with the search in a sheet so its results
 * stay above the keyboard. The server stores the pick as its root, so avoiding
 * bacon avoids every kind of bacon. The profile and onboarding share it.
 */
export const AvoidFoodSheet: React.FC<AvoidFoodSheetProps> = ({
  visible,
  ...content
}) => {
  const { t } = useTranslation();
  const opening = useOpening(visible);

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={content.onDismiss}
      snapPoints={['85%']}
      title={t('dietaryProfile.avoidSheetTitle')}
      contentContainerStyle={commonStyles.bottomSheetContent}
    >
      {opening ? (
        <AvoidFoodContent key={opening.id} active={visible} {...content} />
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  spaced: {
    marginBottom: theme.spacing.md,
  },
}));
