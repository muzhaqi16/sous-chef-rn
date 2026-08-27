import { withUnistyles } from 'react-native-unistyles';
import BarcodeMask from '#features/barcode/components/BarcodeMask';

export const ThemedBarcodeMask = withUnistyles(BarcodeMask, theme => ({
  edgeColor: theme.colors.primary,
  backgroundColor: theme.colors.overlay,
}));
