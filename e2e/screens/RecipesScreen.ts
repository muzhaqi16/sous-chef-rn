/**
 * Deliberately minimal: `recipes-screen` and `tab-recipe` are the only testIDs
 * the Recipes surface renders, so only navigation lives here. Add a method back
 * when what it drives has a testID in `src/`.
 */

import { BaseScreen } from './BaseScreen';

export class RecipesScreen extends BaseScreen {
  protected screenID = 'recipes-screen';

  /** 'tab-recipe' is singular: the id derives from the route name 'Recipe'. */
  async navigateToTab() {
    await this.tapByID('tab-recipe');
    await this.waitForScreen();
  }
}
