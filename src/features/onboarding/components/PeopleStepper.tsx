import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

interface PeopleStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  /** What the count is of, for a screen reader. */
  label: string;
}

/** A count of people, one tap fewer or more, adjustable by a screen reader. */
export const PeopleStepper = ({
  value,
  min,
  max,
  onChange,
  label,
}: PeopleStepperProps) => {
  const { t } = useTranslation();
  const change = (delta: number) =>
    onChange(Math.min(max, Math.max(min, value + delta)));
  const valueLabel = t('onBoarding.householdPeople', { count: value });

  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: valueLabel }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event =>
        change(event.nativeEvent.actionName === 'increment' ? 1 : -1)
      }
    >
      <AppPressable
        onPress={() => change(-1)}
        disabled={value <= min}
        accessibilityLabel={t('onBoarding.householdFewer')}
        style={styles.button}
        testID={onboardingTestIDs.householdFewer}
      >
        <Icon
          name="remove-circle-outline"
          size={32}
          tone={value <= min ? 'textTertiary' : 'primary'}
        />
      </AppPressable>
      <Text role="subheading" style={styles.value}>
        {valueLabel}
      </Text>
      <AppPressable
        onPress={() => change(1)}
        disabled={value >= max}
        accessibilityLabel={t('onBoarding.householdMore')}
        style={styles.button}
        testID={onboardingTestIDs.householdMore}
      >
        <Icon
          name="add-circle-outline"
          size={32}
          tone={value >= max ? 'textTertiary' : 'primary'}
        />
      </AppPressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  button: {
    padding: theme.spacing.xs,
  },
  value: {
    minWidth: 120,
    textAlign: 'center',
  },
}));
