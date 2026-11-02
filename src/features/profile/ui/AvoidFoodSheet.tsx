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

/** Mildest first: avoiding a food is the common case, so it leads. */
const SEVERITIES: RestrictionSeverity[] = [
  RestrictionSeverity.Preference,
  RestrictionSeverity.Intolerance,
  RestrictionSeverity.Allergy,
];

interface AvoidFoodSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Resolves whether the food was added; the sheet closes only when it was. */
  onPick: (
    food: { id: string; name: string },
    severity: RestrictionSeverity,
  ) => Promise<boolean>;
}

/**
 * Picks a catalog food to avoid, with the search in a sheet so its results
 * stay above the keyboard. The server stores the pick as its root, so avoiding
 * bacon avoids every kind of bacon. The profile and onboarding share it.
 */
export const AvoidFoodSheet: React.FC<AvoidFoodSheetProps> = ({
  visible,
  onDismiss,
  onPick,
}) => {
  const { t } = useTranslation();
  const [severity, setSeverity] = useState(RestrictionSeverity.Preference);
  const [saving, setSaving] = useState(false);

  // Adjusting state during render: a fresh open starts at the mildest.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setSeverity(RestrictionSeverity.Preference);
  }

  const handlePick = async (food: { id: string; name: string }) => {
    if (saving) return;
    setSaving(true);
    const added = await onPick(food, severity);
    setSaving(false);
    if (added) onDismiss();
  };

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['85%']}
      title={t('dietaryProfile.avoidSheetTitle')}
      contentContainerStyle={commonStyles.bottomSheetContent}
    >
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
          active={visible}
          onPick={food => {
            void handlePick(food);
          }}
        />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  spaced: {
    marginBottom: theme.spacing.md,
  },
}));
