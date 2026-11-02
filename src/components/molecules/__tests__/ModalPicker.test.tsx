import { render, screen } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { ModalPicker } from '../ModalPicker';

jest.mock('#components/templates/ActionTray/ActionTray', () => ({
  ActionTray: ({ children }: { children: unknown }) => children,
}));

const OPTIONS = [{ label: 'Personal', value: 'personal' }];

describe('ModalPicker', () => {
  it('shows what stands in for options a failed read left out', () => {
    render(
      <ModalPicker
        label="Home"
        visible
        options={OPTIONS}
        unavailable={<Text>Could not load</Text>}
        selected={null}
        onSelect={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByText('Personal')).toBeTruthy();
    expect(screen.getByText('Could not load')).toBeTruthy();
  });
});
