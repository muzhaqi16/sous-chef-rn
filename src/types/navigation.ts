// Navigation related types

/** Source context for barcode scanner navigation */
export type BarcodeSource = 'pantry' | 'shoppingList';
export interface ModalProps {
  visible: boolean;
  onClose: () => void;
}
