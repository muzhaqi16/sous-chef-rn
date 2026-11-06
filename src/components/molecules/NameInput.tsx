import React from 'react';
import type { BaseInputProps } from '#components/molecules/BaseInput/BaseInput';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';

/** A person's name, which autofill offers from the device's contact card. */
export const NameInput: React.FC<
  Omit<BaseInputProps, 'autoCapitalize' | 'autoComplete' | 'textContentType'>
> = props => (
  <BaseInput
    autoCapitalize="words"
    autoComplete="name"
    textContentType="name"
    {...props}
  />
);
