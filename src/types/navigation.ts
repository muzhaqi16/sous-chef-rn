// Navigation related types
import { NavigationProp, RouteProp } from '@react-navigation/native';

export interface BaseScreenProps {
  navigation: any;
  route: any;
}

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
}

// Deep Link Screen Parameters
export type DeepLinkScreenParams = {
  EmailVerification: { token: string };
  ResetPassword: { token: string };
  AcceptInvitation: { token: string };
};

// Typed navigation helpers for deep link screens
export type DeepLinkNavigation = NavigationProp<DeepLinkScreenParams>;

export interface EmailVerificationScreenProps {
  navigation: DeepLinkNavigation;
  route: RouteProp<DeepLinkScreenParams, 'EmailVerification'>;
}

export interface ResetPasswordScreenProps {
  navigation: DeepLinkNavigation;
  route: RouteProp<DeepLinkScreenParams, 'ResetPassword'>;
}

export interface AcceptInvitationScreenProps {
  navigation: DeepLinkNavigation;
  route: RouteProp<DeepLinkScreenParams, 'AcceptInvitation'>;
}