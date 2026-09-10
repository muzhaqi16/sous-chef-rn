import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { EmailInput } from '#components/molecules/EmailInput';
import { PhoneInput } from '#components/molecules/PhoneInput';
import { UrlInput } from '#components/molecules/UrlInput';
import { DateInput } from '#components/molecules/DateInput';
import { NameInput } from '#components/molecules/NameInput';
import { BioInput } from '#components/molecules/BioInput';

export const getInputComponentForField = (fieldKey: string) => {
  switch (fieldKey) {
    case 'firstName':
    case 'lastName':
      return NameInput;

    case 'bio':
      return BioInput;

    case 'phone':
      return PhoneInput;

    case 'website':
    case 'avatar':
    case 'coverImage':
      return UrlInput;

    case 'dateOfBirth':
      return DateInput;

    case 'email':
      return EmailInput;

    default:
      return BaseInput;
  }
};

export const getPlaceholderForField = (fieldKey: string): string => {
  switch (fieldKey) {
    case 'firstName':
      return 'e.g. John';
    case 'lastName':
      return 'e.g. Doe';
    case 'displayName':
      return 'e.g. john_doe';
    case 'bio':
      return 'Tell us about yourself...';
    case 'phone':
      return 'e.g. +1 (555) 123-4567';
    case 'website':
      return 'e.g. https://example.com';
    case 'dateOfBirth':
      return 'e.g. 1990-01-15';
    case 'avatar':
      return 'e.g. https://example.com/avatar.jpg';
    case 'coverImage':
      return 'e.g. https://example.com/cover.jpg';
    case 'email':
      return 'e.g. john@example.com';
    default:
      return `Enter ${fieldKey.toLowerCase()}`;
  }
};

export const getInputLabelForField = (fieldKey: string): string => {
  switch (fieldKey) {
    case 'firstName':
      return 'First Name';
    case 'lastName':
      return 'Last Name';
    case 'displayName':
      return 'Display Name';
    case 'bio':
      return 'Bio';
    case 'phone':
      return 'Phone Number';
    case 'website':
      return 'Website';
    case 'dateOfBirth':
      return 'Date of Birth';
    case 'avatar':
      return 'Avatar URL';
    case 'coverImage':
      return 'Cover Image URL';
    case 'gender':
      return 'Gender';
    case 'profileVisibility':
      return 'Profile Visibility';
    case 'showEmail':
      return 'Show Email';
    case 'showPhone':
      return 'Show Phone';
    default:
      return fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1);
  }
};
