'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { StorageLocationSheet } from '#features/catalog/ui/StorageLocationSheet/StorageLocationSheet';
import { StorageType } from '../../../../src/graphql/generated/schemaTypes';

jest.mock('../../../../src/hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
  }),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('#features/catalog/ui/StorageLocationForm', () => {
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
        initialData={{
          id: '1',
          name: 'Fridge',
          type: StorageType.Refrigerator,
        }}
      />,
    );
    expect(getByText('Edit Storage Location')).toBeTruthy();
  });

  it('closes from the bar', () => {
    const { getByRole } = render(<StorageLocationSheet {...defaultProps} />);
    expect(getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('confirms a new location as Create', () => {
    const { getByRole } = render(<StorageLocationSheet {...defaultProps} />);
    expect(getByRole('button', { name: 'Create' })).toBeTruthy();
  });
});
