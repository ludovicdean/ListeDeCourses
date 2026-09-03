import { Routes } from '@angular/router';

import {
  categoryIdGuard,
  listTypeIdGuard,
  sessionIdGuard,
} from '@core/guards/route-entity.guards';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('@features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'type/:listTypeId',
    canActivate: [listTypeIdGuard],
    loadComponent: () =>
      import('@features/list-type-hub/list-type-hub.component').then((m) => m.ListTypeHubComponent),
  },
  {
    path: 'list/:id',
    canActivate: [sessionIdGuard],
    loadComponent: () =>
      import('@features/shopping/shopping-list-view/shopping-list-view.component').then(
        (m) => m.ShoppingListViewComponent,
      ),
  },
  {
    path: 'base/:listTypeId',
    canActivate: [listTypeIdGuard],
    loadComponent: () =>
      import('@features/base/pages/template-list/base-template-list.component').then(
        (m) => m.BaseTemplateListComponent,
      ),
  },
  {
    path: 'base/:listTypeId/ingredients',
    canActivate: [listTypeIdGuard],
    loadComponent: () =>
      import('@features/base/pages/ingredients/base-ingredients.component').then(
        (m) => m.BaseIngredientsComponent,
      ),
  },
  {
    path: 'base/:listTypeId/meals',
    canActivate: [listTypeIdGuard],
    loadComponent: () =>
      import('@features/base/pages/meals/base-meals.component').then((m) => m.BaseMealsComponent),
  },
  {
    path: 'base/:listTypeId/category/:id',
    canActivate: [listTypeIdGuard, categoryIdGuard],
    loadComponent: () =>
      import('@features/base/pages/category-detail/base-category-detail.component').then(
        (m) => m.BaseCategoryDetailComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
