import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { DetailTemplate } from '../DetailTemplate';

jest.mock('../../molecules/Header', () => {
  const { View, Text: RNText, Pressable } = require('react-native');
  return {
    Header: ({ title, onBack, rightActions }: any) => (
      <View testID="header">
        <Pressable onPress={onBack} testID="header-back">
          <RNText>Back</RNText>
        </Pressable>
        {title ? <RNText>{title}</RNText> : null}
        {rightActions?.map((action: any, i: number) => (
          <Pressable key={i} onPress={action.onPress} testID={`header-action-${i}`}>
            <RNText>{action.icon || 'action'}</RNText>
          </Pressable>
        ))}
      </View>
    ),
  };
});

jest.mock('../../base/Button', () => {
  const { Pressable, Text: RNText } = require('react-native');
  return {
    Button: ({ children, onPress }: any) => (
      <Pressable onPress={onPress} testID="primary-action-button">
        <RNText>{children}</RNText>
      </Pressable>
    ),
  };
});

jest.mock('#utils/iconUtils', () => ({
  Icon: 'Icon',
}));

describe('DetailTemplate', () => {
  const defaultProps = {
    title: 'Item Details',
    onBack: jest.fn(),
    sections: [
      { title: 'Info', content: <Text>Item info here</Text> },
      { content: <Text>Section without title</Text> },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the header with title', () => {
    render(<DetailTemplate {...defaultProps} />);
    expect(screen.getByText('Item Details')).toBeTruthy();
  });

  it('renders section titles', () => {
    render(<DetailTemplate {...defaultProps} />);
    expect(screen.getByText('Info')).toBeTruthy();
  });

  it('renders section content', () => {
    render(<DetailTemplate {...defaultProps} />);
    expect(screen.getByText('Item info here')).toBeTruthy();
    expect(screen.getByText('Section without title')).toBeTruthy();
  });

  it('calls onBack when back is pressed', () => {
    render(<DetailTemplate {...defaultProps} />);
    fireEvent.press(screen.getByTestId('header-back'));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('renders primary action button when provided', () => {
    const onPress = jest.fn();
    render(
      <DetailTemplate
        {...defaultProps}
        primaryAction={{ label: 'Save', onPress }}
      />,
    );
    expect(screen.getByText('Save')).toBeTruthy();
    fireEvent.press(screen.getByTestId('primary-action-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not render primary action when not provided', () => {
    render(<DetailTemplate {...defaultProps} />);
    expect(screen.queryByTestId('primary-action-button')).toBeNull();
  });

  it('renders header actions', () => {
    const headerAction = { icon: 'edit' as any, onPress: jest.fn() };
    render(
      <DetailTemplate
        {...defaultProps}
        headerActions={[headerAction]}
      />,
    );
    fireEvent.press(screen.getByTestId('header-action-0'));
    expect(headerAction.onPress).toHaveBeenCalledTimes(1);
  });
});
