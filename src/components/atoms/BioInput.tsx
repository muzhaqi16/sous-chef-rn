import React from 'react';
import {BaseInput, BaseInputProps} from './BaseInput';

// Bio Input Component (multiline)
export const BioInput: React.FC<
  Omit<BaseInputProps, 'multiline' | 'numberOfLines'>
> = props => <BaseInput multiline numberOfLines={4} {...props} />;
