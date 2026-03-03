'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { StorageLocationSheet } from '../../../../src/components/modals/StorageLocationSheet/StorageLocationSheet';

jest.mock('../../../../src/apollo/links/tokenScheduler');
jest.mock('../../../../src/apollo/links/refreshToken');

jest.mock('../../../../src/hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        primary: '#007AFF',
        border: '#ddd',
      },
    },
  }),
}));
jest.mock('../../../../src/components/organisms/storageLocation/StorageLocationForm', () => {
  const { forwardRef } = require('react');
  return {
    StorageLocationForm: forwardRef(() => null),
  };
});

describe('StorageLocationSheet', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSubmit: jest.fn(async () => true),
    availableLocations: [],
  };

  it('renders without crashing', () => {
    const { toJSON } = render(<StorageLocationSheet {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows Add Storage Location title when creating', () => {
    const { getByText } = render(<StorageLocationSheet {...defaultProps} />);
    expect(getByText('Add Storage Location')).toBeTruthy();
  });

  it('shows Edit Storage Location title when editing', () => {
    const { getByText } = render(
      <StorageLocationSheet
        {...defaultProps}
        initialData={{ id: '1', name: 'Fridge', type: 'REFRIGERATOR' }}
      />,
    );
    expect(getByText('Edit Storage Location')).toBeTruthy();
  });

  it('shows Cancel button', () => {
    const { getByText } = render(<StorageLocationSheet {...defaultProps} />);
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('shows Create button for new locations', () => {
    const { getByText } = render(<StorageLocationSheet {...defaultProps} />);
    expect(getByText('Create')).toBeTruthy();
  });
});
