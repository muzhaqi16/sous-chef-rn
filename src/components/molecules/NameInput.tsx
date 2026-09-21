import React from 'react';
import type { BaseInputProps } from '#components/molecules/BaseInput/BaseInput';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';

// Name Input Component
export const NameInput: React.FC<
  Omit<BaseInputProps, 'autoCapitalize'>
> = props => <BaseInput autoCapitalize="words" {...props} />;
