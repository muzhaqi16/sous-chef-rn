import React from 'react';
import { useTranslation } from '#/i18n';
import {
  BaseInput,
  BaseInputProps,
} from '#components/molecules/BaseInput/BaseInput';

export const EmailInput: React.FC<
  Omit<
    BaseInputProps,
    'keyboardType' | 'autoCapitalize' | 'autoCorrect' | 'placeholder'
  >
> = props => {
  const { t } = useTranslation();
  return (
    <BaseInput
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      placeholder={t('auth.emailPlaceholder')}
      {...props}
    />
  );
};
