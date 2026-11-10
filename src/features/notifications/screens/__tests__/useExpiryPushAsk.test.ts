import { act, renderHook } from '@testing-library/react-native';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import type { AlertButton } from '#platform/presenters';
import { useStore } from '#store';
import { useExpiryPushAsk } from '../useExpiryPushAsk';

let mockPushEnabled = false;
jest.mock('#features/notifications/hooks/useNotificationSettings', () => ({
  useNotificationSettings: () => ({
    settings: { pushEnabled: mockPushEnabled },
    hasPreferences: true,
    updateMultipleSettings: jest.fn(),
  }),
}));

let mockHasPermission: boolean | null = false;
const mockTurnOnPush = jest.fn();
jest.mock('../useTurnOnPush', () => ({
  useTurnOnPush: () => ({
    hasPermission: mockHasPermission,
    checkPermissions: jest.fn(),
    turnOnPush: mockTurnOnPush,
  }),
}));

let buttons: AlertButton[] = [];
const alert = jest
  .spyOn(alertService, 'alert')
  .mockImplementation((_title, _message, given) => {
    buttons = given ?? [];
  });

const press = (text: string) =>
  act(() => {
    buttons.find(button => button.text === text)?.onPress?.();
  });

const signIn = (onBoarded = true) =>
  act(() => {
    useStore.setState({
      user: {
        id: 'u1',
        email: 'new@example.com',
        emailVerified: true,
        onBoarded,
      },
      pushAskAnswered: {},
    });
  });

const renderAsk = (datedItemName: string | null) =>
  renderHook(
    ({ name }: { name: string | null }) =>
      useExpiryPushAsk({ datedItemName: name, isFocused: true }),
    { initialProps: { name: datedItemName } },
  );

beforeEach(() => {
  jest.clearAllMocks();
  buttons = [];
  mockPushEnabled = false;
  mockHasPermission = false;
  mockTurnOnPush.mockResolvedValue(true);
});

describe('useExpiryPushAsk', () => {
  it('Staples with dates: asks on Pantry, naming the food that expires first', () => {
    signIn();

    renderAsk('Milk');

    expect(alert).toHaveBeenCalledWith(
      t('notifications.expiryAsk.title'),
      t('notifications.expiryAsk.message', { item: 'Milk' }),
      expect.any(Array),
    );
  });

  it('Nothing dated yet: no ask', () => {
    signIn();

    renderAsk(null);

    expect(alert).not.toHaveBeenCalled();
  });

  it('A receipt adds milk: the ask appears once dated food is there', () => {
    signIn();
    const { rerender } = renderAsk(null);

    rerender({ name: 'Milk' });

    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('asks nothing during onboarding', () => {
    signIn(false);

    renderAsk('Milk');

    expect(alert).not.toHaveBeenCalled();
  });

  it('The user agrees: push and expiry alerts go on, through the system prompt', () => {
    signIn();
    renderAsk('Milk');

    press(t('notifications.expiryAsk.turnOn'));

    expect(mockTurnOnPush).toHaveBeenCalledWith({
      expirationNotifications: true,
    });
    expect(useStore.getState().pushAskAnswered.u1).toBe(true);
  });

  it('The user declines: no system prompt, and notifications stay off', () => {
    signIn();
    renderAsk('Milk');

    press(t('labels.notNow'));

    expect(mockTurnOnPush).not.toHaveBeenCalled();
    expect(useStore.getState().pushAskAnswered.u1).toBe(true);
  });

  it('Already allowed and on: no ask', () => {
    signIn();
    mockHasPermission = true;
    mockPushEnabled = true;

    renderAsk('Milk');

    expect(alert).not.toHaveBeenCalled();
  });

  it('Allowed by the device but off in the app: asks', () => {
    signIn();
    mockHasPermission = true;

    renderAsk('Milk');

    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('Declined earlier: no ask when more dated food arrives', () => {
    signIn();
    act(() => useStore.getState().answerPushAsk('u1'));

    renderAsk('Yogurt');

    expect(alert).not.toHaveBeenCalled();
  });
});
