import React from 'react';
import { useTranslation } from '#/i18n';
import type { BaseInputProps } from '#components/molecules/BaseInput/BaseInput';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';

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
      autoComplete="email"
      textContentType="emailAddress"
      placeholder={t('auth.emailPlaceholder')}
      {...props}
    />
  );
};
