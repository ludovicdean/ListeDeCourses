import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { shoppingDb } from '@core/database/shopping-db';
import { parsePositiveIntParam } from '@core/utils/parse-route-param';

export const listTypeIdGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const listTypeId = parsePositiveIntParam(route.paramMap.get('listTypeId'));

  if (listTypeId === null) {
    return router.createUrlTree(['/']);
  }

  const listType = await shoppingDb.baseListTypes.get(listTypeId);
  if (!listType) {
    return router.createUrlTree(['/']);
  }

  return true;
};

export const sessionIdGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const sessionId = parsePositiveIntParam(route.paramMap.get('id'));

  if (sessionId === null) {
    return router.createUrlTree(['/']);
  }

  const session = await shoppingDb.shoppingLists.get(sessionId);
  if (!session) {
    return router.createUrlTree(['/']);
  }

  return true;
};

export const categoryIdGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const listTypeId = parsePositiveIntParam(route.paramMap.get('listTypeId'));
  const categoryId = parsePositiveIntParam(route.paramMap.get('id'));

  if (listTypeId === null || categoryId === null) {
    return router.createUrlTree(['/']);
  }

  const category = await shoppingDb.baseCategories.get(categoryId);
  if (!category || category.listTypeId !== listTypeId) {
    return router.createUrlTree(['/base', listTypeId]);
  }

  return true;
};
