import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { HouseholdService } from '@core/services/household.service';
import { SupabaseService } from '@core/services/supabase.service';

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const supabase = inject(SupabaseService);
  const householdService = inject(HouseholdService);

  const { data } = await supabase.supabase.auth.getSession();

  if (!data.session) {
    return router.createUrlTree(['/login']);
  }

  await householdService.ensureHouseholdForCurrentUser();
  return true;
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

export const resetPasswordGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const supabase = inject(SupabaseService);

  const { data } = await supabase.supabase.auth.getSession();
  if (data.session) {
    return true;
  }

  return router.createUrlTree(['/forgot-password']);
};
