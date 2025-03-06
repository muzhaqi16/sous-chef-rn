export interface Colors {
  typography: string;
  background: string;
  darker: string;
  lighter: string;
  black: string;
  white: string;
  button: string;
  backgroundColor: string;
  primary: string;
  secondary?: string;
  buttonText: string;
  border?: string;
  placeholder?: string;
  chipBackground?: string;
  chipSelectedBackground?: string;
  chipText?: string;
}

const commonColors = {
  white: '#FFFFFF',
  black: '#000000',
};

export const lightColors: Colors = {
  ...commonColors,
  darker: '#ffffff',
  lighter: '#f0f0f0',
  black: '#000000',
  button: '#007BFF',
  backgroundColor: '#f0f0f0',
  buttonText: '#FFFFFF',
  background: '#FFFFFF',
  primary: '#FF8A4C', // The orange color in the design
  secondary: '#FFA559',
  typography: '#2E2E2E',
  border: '#ECECEC',
  placeholder: '#999999',
  chipBackground: '#FCEDE3',
  chipSelectedBackground: '#FF8A4C',
  chipText: '#2E2E2E',
};

export const darkColors: Colors = {
  ...commonColors,
  typography: '#ffffff',
  background: '#000000',
  darker: '#000000',
  lighter: '#1a1a1a',
  white: '#ffffff',
  button: '#007BFF',
  backgroundColor: '#1a1a1a',
  primary: '#FFFFFF',
  buttonText: '#FFFFFF',
};
