import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../Card';

describe('Card', () => {
  it('renders title text', () => {
    render(<Card title="Test Card" />);
    expect(screen.getByText('Test Card')).toBeTruthy();
  });

  it('renders subtitle text', () => {
    render(<Card title="Card" subtitle="Subtitle here" />);
    expect(screen.getByText('Subtitle here')).toBeTruthy();
  });

  it('renders description text', () => {
    render(<Card title="Card" description="Some description" />);
    expect(screen.getByText('Some description')).toBeTruthy();
  });

  it('renders price when provided', () => {
    render(<Card title="Item" price={9.99} />);
    expect(screen.getByText('$9.99')).toBeTruthy();
  });

  it('renders meta text as string', () => {
    render(<Card title="Item" meta="SKU-12345" />);
    expect(screen.getByText('SKU-12345')).toBeTruthy();
  });

  it('renders meta text as array', () => {
    render(<Card title="Item" meta={['Line 1', 'Line 2']} />);
    expect(screen.getByText('Line 1')).toBeTruthy();
    expect(screen.getByText('Line 2')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    const mockPress = jest.fn();
    render(<Card title="Pressable Card" onPress={mockPress} />);
    await user.press(screen.getByRole('button'));
    expect(mockPress).toHaveBeenCalledTimes(1);
  });

  it('does not render Pressable when onPress is not provided', () => {
    render(<Card title="Static Card" testID="card" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders rightElement when provided', () => {
    render(<Card title="Card" rightElement={<Text>Right</Text>} />);
    expect(screen.getByText('Right')).toBeTruthy();
  });

  it('renders bottomElement when provided', () => {
    render(<Card title="Card" bottomElement={<Text>Bottom</Text>} />);
    expect(screen.getByText('Bottom')).toBeTruthy();
  });

  it('renders with testID', () => {
    render(<Card title="Card" testID="my-card" />);
    expect(screen.getByTestId('my-card')).toBeTruthy();
  });
});
