import { Injectable, inject } from '@angular/core';

import { BaseListCatalogSeedService } from './base-list-catalog-seed.service';
import { BaseListTypeService } from './base-list-type.service';
import { HouseholdService } from './household.service';

@Injectable({ providedIn: 'root' })
export class AuthSetupService {
  private readonly householdService = inject(HouseholdService);
  private readonly baseListTypeService = inject(BaseListTypeService);
  private readonly catalogSeed = inject(BaseListCatalogSeedService);

  async completeSetupForAuthenticatedUser(): Promise<void> {
    await this.householdService.ensureHouseholdForCurrentUser();
    await this.baseListTypeService.ensureDefaultTypes();
    await this.catalogSeed.ensureWeeklyCatalogIfEmpty();
  }
}
