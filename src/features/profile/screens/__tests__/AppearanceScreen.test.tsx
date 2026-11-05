import React from 'react';
import { render, screen, within } from '@testing-library/react-native';
import { t } from '#/i18n';
import { colors } from '#/theme/foundations/colors';
import AppearanceScreen from '../AppearanceScreen';

let mockSavedColor: string | null = null;

jest.mock('#store/useAppStore', () => ({
  ...jest.requireActual('#store/useAppStore'),
  usePreferences: () => ({ theme: 'system', setTheme: jest.fn() }),
  useThemePreferences: () => ({
    primaryColorOverride: mockSavedColor,
    densityPreference: 'comfortable',
    fontScalePreference: 'default',
    highContrast: false,
    setPrimaryColorOverride: jest.fn(),
    setDensityPreference: jest.fn(),
    setFontScalePreference: jest.fn(),
    setHighContrast: jest.fn(),
  }),
}));

// Font Scale has a "Default" too: read inside the brand colour group.
const swatch = (labelKey: 'labels.default' | 'storageLocationForm.colorBlue') =>
  within(screen.getByLabelText(t('appearance.brandColor'))).getByRole('radio', {
    name: t(labelKey),
  });

describe('the brand colour swatches', () => {
  it('announce each colour as a radio, the saved one checked', () => {
    mockSavedColor = colors.accentSwatches.blue;
    render(<AppearanceScreen />);

    expect(swatch('storageLocationForm.colorBlue')).toBeChecked();
    expect(swatch('labels.default')).not.toBeChecked();
  });

  it('check Default when the saved colour is no longer offered', () => {
    // Teal, removed because no content reads on it at AA.
    mockSavedColor = '#0D9488';
    render(<AppearanceScreen />);

    expect(swatch('labels.default')).toBeChecked();
  });
});
