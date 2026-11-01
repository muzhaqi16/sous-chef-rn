import React from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  PantrySortDirection,
  PantrySortOption,
} from '#store/slices/preferenceTypes';
import { PantrySortModal } from '../PantrySortModal';

jest.mock('#hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/atoms/Icon', () => {
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => <Text>{name}</Text> };
});

const renderModal = (sortDirection: PantrySortDirection) =>
  render(
    <PantrySortModal
      visible
      sortOption={PantrySortOption.RECENT}
      sortDirection={sortDirection}
      onSelect={jest.fn()}
      onClose={jest.fn()}
    />,
  );

describe('PantrySortModal', () => {
  it('points down for Recently Added newest first', () => {
    renderModal(PantrySortDirection.DESC);

    expect(screen.getByText('arrow-down')).toBeTruthy();
    expect(screen.queryByText('arrow-up')).toBeNull();
  });

  it('points up for Recently Added oldest first', () => {
    renderModal(PantrySortDirection.ASC);

    expect(screen.getByText('arrow-up')).toBeTruthy();
    expect(screen.queryByText('arrow-down')).toBeNull();
  });
});
