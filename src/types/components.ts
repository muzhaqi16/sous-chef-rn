// Component related shared types

export interface ButtonVariants {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export interface FormFieldProps {
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export interface BottomSheetRef {
  expand: () => void;
  close: () => void;
}