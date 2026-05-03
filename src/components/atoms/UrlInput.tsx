// URL Input Component (for websites, images, etc.)
import React from 'react';
import { BaseInput, BaseInputProps } from './BaseInput/BaseInput';

export const UrlInput: React.FC<
  Omit<BaseInputProps, 'keyboardType' | 'autoCapitalize' | 'autoCorrect'>
> = props => (
  <BaseInput
    keyboardType="url"
    autoCapitalize="none"
    autoCorrect={false}
    {...props}
  />
);
