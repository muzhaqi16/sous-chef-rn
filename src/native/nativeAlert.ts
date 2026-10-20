import { Alert } from 'react-native';
import type { AlertPresenter } from '#platform/presenters';

/** The OS alert, which can show before the app's dialog host has mounted. */
export const presentNativeAlert: AlertPresenter = ({
  title,
  message,
  buttons,
}) => {
  Alert.alert(
    title,
    message,
    buttons.map(({ text, style, onPress }) => ({ text, style, onPress })),
  );
};
