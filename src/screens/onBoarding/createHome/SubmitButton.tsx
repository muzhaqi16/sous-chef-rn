import React from 'react';
import {Button} from '#components';

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
    variant="primary"
    disabled={isCreating}
  />
);
