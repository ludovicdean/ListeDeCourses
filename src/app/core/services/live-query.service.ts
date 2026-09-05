import { Injectable, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { shareReplay, skip } from 'rxjs/operators';

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
    return new Observable<T>((subscriber) => {
      let active = true;

      const runQuery = () => {
        void Promise.resolve(querier()).then(
          (value) => {
            if (active) {
              this.zone.run(() => subscriber.next(value));
            }
          },
          (error) => {
            if (active) {
              this.zone.run(() => subscriber.error(error));
            }
          },
        );
      };

      runQuery();

      const subscription = this.db.changes$.pipe(skip(1)).subscribe(() => runQuery());

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  }
}
