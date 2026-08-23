import { Routes } from '@angular/router';

import { BaseCategoryDetailComponent } from './features/base/base-category-detail/base-category-detail.component';
import { BaseIngredientsComponent } from './features/base/base-ingredients/base-ingredients.component';
import { BaseMealsComponent } from './features/base/base-meals/base-meals.component';
import { BaseTemplateListComponent } from './features/base/base-template-list/base-template-list.component';
import { HomeComponent } from './features/home/home.component';
import { ListTypeHubComponent } from './features/list-type-hub/list-type-hub.component';
import { ShoppingListViewComponent } from './features/shopping/shopping-list-view/shopping-list-view.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'type/:listTypeId', component: ListTypeHubComponent },
  { path: 'list/:id', component: ShoppingListViewComponent },
  { path: 'base/:listTypeId', component: BaseTemplateListComponent },
  { path: 'base/:listTypeId/ingredients', component: BaseIngredientsComponent },
  { path: 'base/:listTypeId/meals', component: BaseMealsComponent },
  { path: 'base/:listTypeId/category/:id', component: BaseCategoryDetailComponent },
  { path: '**', redirectTo: '' },
];
