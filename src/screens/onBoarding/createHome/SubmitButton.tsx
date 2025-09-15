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
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  nextText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
}));
