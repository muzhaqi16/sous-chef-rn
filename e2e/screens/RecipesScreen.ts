/**
 * Only navigation lives here: no spec drives the Recipes surface past reaching
 * it. Add a method when one does, with its id from `recipesTestIDs`.
 */

import { kitTestIDs } from '../../src/components/testIDs';
import { recipesTestIDs } from '../../src/features/recipes/testIDs';
import { BaseScreen } from './BaseScreen';

export class RecipesScreen extends BaseScreen {
  protected screenID = recipesTestIDs.recipesScreen;

  /** The tab id derives from the route name, which is the singular `Recipe`. */
  async navigateToTab() {
    await this.tapByID(kitTestIDs.tab('Recipe'));
    await this.waitForScreen();
  }
}
