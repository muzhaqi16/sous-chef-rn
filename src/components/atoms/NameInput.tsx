import React from 'react';
import {BaseInput, BaseInputProps} from './BaseInput/BaseInput';

// Name Input Component
export const NameInput: React.FC<
  Omit<BaseInputProps, 'autoCapitalize'>
> = props => <BaseInput autoCapitalize="words" {...props} />;
