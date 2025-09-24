// Navigation related types

export interface BaseScreenProps {
  navigation: any;
  route: any;
}

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
}