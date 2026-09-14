import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { parsePositiveIntParam } from '@core/utils/parse-route-param';
import { SupabaseService } from '@core/services/supabase.service';

export const listTypeIdGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const supabase = inject(SupabaseService);
  const listTypeId = parsePositiveIntParam(route.paramMap.get('listTypeId'));

  if (listTypeId === null) {
    return router.createUrlTree(['/']);
  }

  const { data } = await supabase.supabase
    .from('base_list_types')
    .select('id')
    .eq('id', listTypeId)
    .eq('user_id', supabase.userId)
    .maybeSingle();

  if (!data) {
    return router.createUrlTree(['/']);
  }

  return true;
};

export const sessionIdGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const supabase = inject(SupabaseService);
  const sessionId = parsePositiveIntParam(route.paramMap.get('id'));

  if (sessionId === null) {
    return router.createUrlTree(['/']);
  }

  const { data } = await supabase.supabase
    .from('shopping_lists')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', supabase.userId)
    .maybeSingle();

  if (!data) {
    return router.createUrlTree(['/']);
  }

  return true;
};

export const categoryIdGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const supabase = inject(SupabaseService);
  const listTypeId = parsePositiveIntParam(route.paramMap.get('listTypeId'));
  const categoryId = parsePositiveIntParam(route.paramMap.get('id'));

  if (listTypeId === null || categoryId === null) {
    return router.createUrlTree(['/']);
  }

  const { data } = await supabase.supabase
    .from('base_categories')
    .select('list_type_id')
    .eq('id', categoryId)
    .eq('user_id', supabase.userId)
    .maybeSingle();

  if (!data || Number(data['list_type_id']) !== listTypeId) {
    return router.createUrlTree(['/base', listTypeId]);
  }

  return true;
};
