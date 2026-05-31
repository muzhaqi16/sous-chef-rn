'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { StorageLocationSheet } from '../../../../src/components/modals/StorageLocationSheet/StorageLocationSheet';
import { StorageType } from '../../../../src/graphql/generated/schemaTypes';

jest.mock('../../../../src/apollo/links/tokenScheduler');
jest.mock('../../../../src/apollo/links/refreshToken');

jest.mock('../../../../src/hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
  }),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
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
        initialData={{ id: '1', name: 'Fridge', type: StorageType.Refrigerator }}
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
