import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { SqliteRepository } from '@core/database/sqlite.repository';
import { parsePositiveIntParam } from '@core/utils/parse-route-param';

export const listTypeIdGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const repo = inject(SqliteRepository);
  const listTypeId = parsePositiveIntParam(route.paramMap.get('listTypeId'));

  if (listTypeId === null) {
    return router.createUrlTree(['/']);
  }

  const row = await repo.get<Record<string, unknown>>('SELECT id FROM baseListTypes WHERE id = ?;', [
    listTypeId,
  ]);
  if (!row) {
    return router.createUrlTree(['/']);
  }

  return true;
};

export const sessionIdGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const repo = inject(SqliteRepository);
  const sessionId = parsePositiveIntParam(route.paramMap.get('id'));

  if (sessionId === null) {
    return router.createUrlTree(['/']);
  }

  const row = await repo.get<Record<string, unknown>>('SELECT id FROM shoppingLists WHERE id = ?;', [
    sessionId,
  ]);
  if (!row) {
    return router.createUrlTree(['/']);
  }

  return true;
};

export const categoryIdGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const repo = inject(SqliteRepository);
  const listTypeId = parsePositiveIntParam(route.paramMap.get('listTypeId'));
  const categoryId = parsePositiveIntParam(route.paramMap.get('id'));

  if (listTypeId === null || categoryId === null) {
    return router.createUrlTree(['/']);
  }

  const row = await repo.get<Record<string, unknown>>(
    'SELECT listTypeId FROM baseCategories WHERE id = ?;',
    [categoryId],
  );
  if (!row || Number(row['listTypeId']) !== listTypeId) {
    return router.createUrlTree(['/base', listTypeId]);
  }

  return true;
};
