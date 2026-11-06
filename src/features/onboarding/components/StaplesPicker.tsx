import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { AnimatedChip } from '#components/molecules/AnimatedChip';
import type { useStaplesSelection } from '#features/onboarding/hooks/useStaplesSelection';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

type Staples = ReturnType<typeof useStaplesSelection>;

interface StaplesPickerProps {
  groups: Staples['groups'];
  selectedCount: number;
  isMaxReached: boolean;
  onToggle: (id: string) => void;
}

/** Foods tapped by where they are kept: Fridge, Freezer and Pantry. */
export const StaplesPicker = ({
  groups,
  selectedCount,
  isMaxReached,
  onToggle,
}: StaplesPickerProps) => {
  const { t } = useTranslation();
  return (
    <View style={styles.list}>
      {/* Recipe matching counts these as held, so they are never asked for. */}
      <Text role="caption" tone="secondary" align="center">
        {t('onBoarding.staplesAssumedBasics')}
      </Text>
      <Text role="caption" tone="secondary" align="center">
        {t('labels.selected', { count: selectedCount })}
      </Text>
      {groups.map(group =>
        group.items.length > 0 ? (
          <View
            key={group.state}
            style={styles.group}
            testID={onboardingTestIDs.staplesGroup(group.state)}
          >
            <Text role="bodyStrong" align="center">
              {t(group.labelKey)}
            </Text>
            <View style={styles.chips}>
              {group.items.map(item => (
                <AnimatedChip
                  key={item.id}
                  label={item.name}
                  selected={item.selected}
                  onPress={() => onToggle(item.id)}
                  disabled={!item.selected && isMaxReached}
                  imageUrl={item.imageUrl ?? undefined}
                  reserveImageHeight
                />
              ))}
            </View>
          </View>
        ) : null,
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  list: {
    gap: theme.spacing.lg,
  },
  group: {
    gap: theme.spacing.sm,
  },
  // Centred like the question and captions above, so a short last row sits
  // in the middle rather than trailing off the left.
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
}));
