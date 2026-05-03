/* * Note: This component is a specialized version of BaseInput that is preconfigured for email input.
 * To use in a form with react-hook-form, you can use it like this:
<Controller
  control={control}
  name="email"
  render={({ field, fieldState }) => (
    <EmailInput
      label="Email"
      value={field.value}
      onChangeText={field.onChange}
      onBlur={field.onBlur}
      errorMessage={fieldState.error?.message}
    />
  )}
/>
*/
import React from 'react';
import { BaseInput, BaseInputProps } from './BaseInput/BaseInput';

export const EmailInput: React.FC<
  Omit<
    BaseInputProps,
    'keyboardType' | 'autoCapitalize' | 'autoCorrect' | 'placeholder'
  >
> = props => (
  <BaseInput
    keyboardType="email-address"
    autoCapitalize="none"
    autoCorrect={false}
    placeholder="e.g. john@example.com"
    {...props}
  />
);
