import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '@app/shared/page-header/page-header.component';
import { map, switchMap } from 'rxjs';

import { SessionCardComponent } from '@features/list-type-hub/session-card/session-card.component';
import { getListTypeMeta } from '@core/constants/list-type.config';
import { isShoppingListError } from '@core/errors/shopping-list.errors';
import { ConfirmService } from '@core/services/confirm.service';
import { NotificationService } from '@core/services/notification.service';
import { ShoppingListService } from '@core/services/shopping-list.service';
import { routeParamNumber$ } from '@core/utils/route-param.utils';

@Component({
  selector: 'app-list-type-hub',
  imports: [
    RouterLink,
    PageHeaderComponent,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDialogModule,
    SessionCardComponent,
  ],
  templateUrl: './list-type-hub.component.html',
  styleUrl: './list-type-hub.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListTypeHubComponent {
  private readonly router = inject(Router);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly confirmService = inject(ConfirmService);
  private readonly notificationService = inject(NotificationService);

  private readonly listTypeId$ = routeParamNumber$('listTypeId');

  protected readonly vm = toSignal(
    this.listTypeId$.pipe(
      switchMap((listTypeId) =>
        this.shoppingListService.watchListTypeHub(listTypeId).pipe(
          map((data) => {
            const activeSessions = data.sessions.filter((session) => session.status !== 'completed');
            const completedSessions = data.sessions.filter((session) => session.status === 'completed');

            return {
              listTypeId,
              listType: data.listType,
              activeSessions,
              completedSessions,
            };
          }),
        ),
      ),
    ),
    {
      initialValue: {
        listTypeId: 0,
        listType: undefined,
        activeSessions: [],
        completedSessions: [],
      },
    },
  );

  protected getMeta(name: string) {
    return getListTypeMeta(name);
  }

  protected async createNewList(listTypeId: number): Promise<void> {
    try {
      const listId = await this.shoppingListService.createFromBase(listTypeId);
      await this.router.navigate(['/list', listId]);
    } catch (error) {
      if (isShoppingListError(error)) {
        this.notificationService.error(error.message);
        return;
      }

      throw error;
    }
  }

  protected async openList(sessionId: number): Promise<void> {
    await this.router.navigate(['/list', sessionId]);
  }

  protected async editList(sessionId: number): Promise<void> {
    const list = await this.shoppingListService.getSessionById(sessionId);
    if (!list) {
      return;
    }

    if (list.status === 'preparing') {
      await this.router.navigate(['/list', sessionId]);
      return;
    }

    const confirmed = await this.confirmService.confirm({
      title: 'Revenir en préparation',
      message:
        'Revenir en mode préparation ? Vous pourrez ajouter ou modifier des produits. Les cases « pris en magasin » seront réinitialisées.',
      confirmLabel: 'Revenir en préparation',
    });

    if (!confirmed) {
      return;
    }

    await this.shoppingListService.reopenForEditing(sessionId);
    await this.router.navigate(['/list', sessionId]);
  }

  protected async validateList(sessionId: number): Promise<void> {
    try {
      await this.shoppingListService.validateList(sessionId);
      this.notificationService.info('Liste prête pour le magasin.');
      await this.router.navigate(['/list', sessionId]);
    } catch (error) {
      if (isShoppingListError(error)) {
        this.notificationService.error(error.message);
        return;
      }

      throw error;
    }
  }

  protected async completeList(sessionId: number): Promise<void> {
    const list = await this.shoppingListService.getSessionById(sessionId);
    const label = list?.name?.trim() || 'cette session';
    const confirmed = await this.confirmService.confirm({
      title: 'Terminer les courses',
      message: `Terminer la session « ${label} » ?`,
      confirmLabel: 'Terminer',
    });

    if (confirmed) {
      await this.shoppingListService.updateStatus(sessionId, 'completed');
      await this.router.navigate(['/list', sessionId]);
    }
  }

  protected async deleteList(sessionId: number): Promise<void> {
    const list = await this.shoppingListService.getSessionById(sessionId);
    const label = list?.name?.trim() || 'cette session';
    const confirmed = await this.confirmService.confirm({
      title: 'Supprimer la session',
      message: `Supprimer la session « ${label} » ?`,
      confirmLabel: 'Supprimer',
    });

    if (confirmed) {
      await this.shoppingListService.delete(sessionId);
    }
  }
}
