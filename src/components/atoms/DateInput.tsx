// Date Input Component
import React from 'react';
import { BaseInput, BaseInputProps } from './BaseInput/BaseInput';

// Date Input Component
export const DateInput: React.FC<
  Omit<BaseInputProps, 'keyboardType'>
> = props => <BaseInput keyboardType="numeric" {...props} />;
