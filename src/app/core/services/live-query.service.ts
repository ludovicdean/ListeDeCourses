import { Injectable, NgZone, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { Observable } from 'rxjs';

/**
 * Bridges Dexie liveQuery into Angular's reactivity model.
 * Dexie emits outside NgZone; without this wrapper, views may not refresh
 * until the next user interaction (e.g. navigating back to a route).
 */
@Injectable({ providedIn: 'root' })
export class LiveQueryService {
  private readonly zone = inject(NgZone);

  observe<T>(querier: () => T | Promise<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      const subscription = liveQuery(querier).subscribe({
        next: (value) => {
          this.zone.run(() => subscriber.next(value));
        },
        error: (error) => {
          this.zone.run(() => subscriber.error(error));
        },
        complete: () => {
          this.zone.run(() => subscriber.complete());
        },
      });

      return () => subscription.unsubscribe();
    });
  }
}
