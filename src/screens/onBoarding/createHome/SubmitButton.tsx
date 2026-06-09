import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '#components/base/Button';

export const SubmitButton = ({
  isCreating,
  needsHome,
  onPress,
}: {
  isCreating: boolean;
  needsHome: boolean;
  onPress: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <Button
      title={
        isCreating
          ? needsHome
            ? t('onBoarding.creatingHomeAndPantry')
            : t('onBoarding.creatingPantry')
          : t('labels.next')
      }
      onPress={onPress}
      variant="primary"
      disabled={isCreating}
    />
  );
};
