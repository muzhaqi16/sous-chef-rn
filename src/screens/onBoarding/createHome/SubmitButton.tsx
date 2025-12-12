import React from 'react';
import {Button} from '#components';
import {StyleSheet} from 'react-native-unistyles';

export const SubmitButton = ({
  isCreating,
  needsHome,
  onPress,
}: {
  isCreating: boolean;
  needsHome: boolean;
  onPress: () => void;
}) => (
  <Button
    title={
      isCreating
        ? needsHome
          ? 'Creating Home & Pantry...'
          : 'Creating Pantry...'
        : 'Next'
    }
    onPress={onPress}
    btnStyle={styles.nextButton}
    txtStyle={styles.nextText}
    disabled={isCreating}
  />
);

const styles = StyleSheet.create(theme => ({
  nextButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  nextText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.md,
    fontWeight: 'bold',
  },
}));
