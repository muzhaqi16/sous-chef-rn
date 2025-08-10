import React from 'react';
import {BaseInput, BaseInputProps} from './BaseInput';

// Phone Input Component
export const PhoneInput: React.FC<
  Omit<BaseInputProps, 'keyboardType' | 'autoCorrect'>
> = props => (
  <BaseInput keyboardType="phone-pad" autoCorrect={false} {...props} />
);
