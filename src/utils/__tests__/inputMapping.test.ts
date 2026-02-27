import {
  getPlaceholderForField,
  getInputLabelForField,
} from '../inputMapping';

// Note: getInputComponentForField returns React components — we don't test
// component identity here to avoid importing all input components. The
// placeholder and label functions cover the mapping logic.

describe('getPlaceholderForField', () => {
  it.each([
    ['firstName', 'e.g. John'],
    ['lastName', 'e.g. Doe'],
    ['displayName', 'e.g. john_doe'],
    ['bio', 'Tell us about yourself...'],
    ['phone', 'e.g. +1 (555) 123-4567'],
    ['website', 'e.g. https://example.com'],
    ['dateOfBirth', 'e.g. 1990-01-15'],
    ['avatar', 'e.g. https://example.com/avatar.jpg'],
    ['coverImage', 'e.g. https://example.com/cover.jpg'],
    ['email', 'e.g. john@example.com'],
  ])('returns correct placeholder for %s', (field, expected) => {
    expect(getPlaceholderForField(field)).toBe(expected);
  });

  it('falls back to "Enter <fieldkey>" for unknown fields', () => {
    expect(getPlaceholderForField('someField')).toBe('Enter somefield');
  });
});

describe('getInputLabelForField', () => {
  it.each([
    ['firstName', 'First Name'],
    ['lastName', 'Last Name'],
    ['displayName', 'Display Name'],
    ['bio', 'Bio'],
    ['phone', 'Phone Number'],
    ['website', 'Website'],
    ['dateOfBirth', 'Date of Birth'],
    ['avatar', 'Avatar URL'],
    ['coverImage', 'Cover Image URL'],
    ['gender', 'Gender'],
    ['profileVisibility', 'Profile Visibility'],
    ['showEmail', 'Show Email'],
    ['showPhone', 'Show Phone'],
  ])('returns correct label for %s', (field, expected) => {
    expect(getInputLabelForField(field)).toBe(expected);
  });

  it('capitalizes unknown field key', () => {
    expect(getInputLabelForField('myField')).toBe('MyField');
  });
});
