import { StyleSheet } from 'react-native-unistyles';
import { layoutDefs } from './layoutStyles';
import { formDefs } from './formStyles';
import { listDefs } from './listStyles';
import { modalDefs } from './modalStyles';
import { componentDefs } from './componentStyles';
import { typographyDefs } from './typographyStyles';

/**
 * Combined common styles — backward-compatible single export.
 *
 * New code should prefer importing domain-specific styles directly:
 *   import { layoutStyles } from '#/styles/layoutStyles';
 *   import { formStyles } from '#/styles/formStyles';
 *
 * This combined export is kept so existing consumers don't need to change.
 */
export const commonStyles = StyleSheet.create(theme => ({
  ...layoutDefs(theme),
  ...formDefs(theme),
  ...listDefs(theme),
  ...modalDefs(theme),
  ...componentDefs(theme),
  ...typographyDefs(theme),
}));
