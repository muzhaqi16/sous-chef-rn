import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { BottomSheetAction } from '../BottomSheetAction';

jest.mock('../../atoms/Title', () => {
  const { Text: RNText } = require('react-native');
  return {
    Title: ({ children }: { children: React.ReactNode }) => (
      <RNText>{children}</RNText>
    ),
  };
});

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {
      snapPoints: ['25%', '50%', '90%'],
      enablePanDownToClose: true,
    },
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
    theme: {},
  }),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

describe('BottomSheetAction', () => {
  it('renders children content', () => {
    render(
      <BottomSheetAction>
        <Text>Sheet Content</Text>
      </BottomSheetAction>,
    );
    expect(screen.getByText('Sheet Content')).toBeTruthy();
  });

  it('renders sheet title when provided', () => {
    render(
      <BottomSheetAction sheetTitle="Actions">
        <Text>Content</Text>
      </BottomSheetAction>,
    );
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('renders without title when not provided', () => {
    render(
      <BottomSheetAction>
        <Text>Content</Text>
      </BottomSheetAction>,
    );
    expect(screen.queryByText('Actions')).toBeNull();
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('renders headerRight when provided', () => {
    render(
      <BottomSheetAction sheetTitle="Edit" headerRight={<Text>Done</Text>}>
        <Text>Content</Text>
      </BottomSheetAction>,
    );
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
  });

  it('renders in non-scrollable mode', () => {
    render(
      <BottomSheetAction scrollable={false} sheetTitle="Select">
        <Text>Non-scrollable content</Text>
      </BottomSheetAction>,
    );
    expect(screen.getByText('Select')).toBeTruthy();
    expect(screen.getByText('Non-scrollable content')).toBeTruthy();
  });
});
