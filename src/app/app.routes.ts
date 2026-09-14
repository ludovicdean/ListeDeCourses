import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@core/guards/auth.guard';


import {
  categoryIdGuard,
  listTypeIdGuard,
  sessionIdGuard,
} from '@core/guards/route-entity.guards';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('@features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'type/:listTypeId',
    canActivate: [authGuard,listTypeIdGuard],
    loadComponent: () =>
      import('@features/list-type-hub/list-type-hub.component').then((m) => m.ListTypeHubComponent),
  },
  {
    path: 'list/:id',
    canActivate: [authGuard,sessionIdGuard],
    loadComponent: () =>
      import('@features/shopping/shopping-list-view/shopping-list-view.component').then(
        (m) => m.ShoppingListViewComponent,
      ),
  },
  {
    path: 'base/:listTypeId',
    canActivate: [authGuard,listTypeIdGuard],
    loadComponent: () =>
      import('@features/base/pages/template-list/base-template-list.component').then(
        (m) => m.BaseTemplateListComponent,
      ),
  },
  {
    path: 'base/:listTypeId/ingredients',
    canActivate: [authGuard,listTypeIdGuard],
    loadComponent: () =>
      import('@features/base/pages/ingredients/base-ingredients.component').then(
        (m) => m.BaseIngredientsComponent,
      ),
  },
  {
    path: 'base/:listTypeId/meals',
    canActivate: [authGuard,listTypeIdGuard],
    loadComponent: () =>
      import('@features/base/pages/meals/base-meals.component').then((m) => m.BaseMealsComponent),
  },
  {
    path: 'base/:listTypeId/category/:id',
    canActivate: [authGuard,listTypeIdGuard, categoryIdGuard],
    loadComponent: () =>
      import('@features/base/pages/category-detail/base-category-detail.component').then(
        (m) => m.BaseCategoryDetailComponent,
      ),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('@features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  { path: '**', redirectTo: '' },
];
