import { Injectable, NgZone, inject } from '@angular/core';
import { Observable, defer, switchMap } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

import { SqliteDatabaseService } from '@core/database/sqlite-database.service';

/**
 * Bridges SQLite changes into Angular's reactivity model.
 * Re-runs the query whenever the database emits a change notification.
 */
@Injectable({ providedIn: 'root' })
export class LiveQueryService {
  private readonly zone = inject(NgZone);
  private readonly db = inject(SqliteDatabaseService);

  observe<T>(querier: () => T | Promise<T>): Observable<T> {
    return defer(() => Promise.resolve(querier())).pipe(
      switchMap((initial) => {
        return new Observable<T>((subscriber) => {
          subscriber.next(initial);

          const subscription = this.db.changes$.subscribe(async () => {
            try {
              const value = await querier();
              this.zone.run(() => subscriber.next(value));
            } catch (error) {
              this.zone.run(() => subscriber.error(error));
            }
          });

          return () => subscription.unsubscribe();
        });
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}
