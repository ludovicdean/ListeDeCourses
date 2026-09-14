import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { SupabaseService } from '@core/services/supabase.service';

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const supabase = inject(SupabaseService);

  const { data } = await supabase.supabase.auth.getSession();

  if (data.session) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const supabase = inject(SupabaseService);

  const { data } = await supabase.supabase.auth.getSession();

  if (!data.session) {
    return true;
  }

  return router.createUrlTree(['/']);
};