import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';

import { sqlite3Worker1Promiser } from '@sqlite.org/sqlite-wasm';

import { CREATE_SCHEMA_SQL, DB_FILENAME } from './sqlite-schema';

export type SqliteRow = Record<string, unknown>;

export interface SqliteExecOptions {
  sql: string;
  bind?: BindableValue[];
  lastInsertRowId?: boolean;
}

export type BindableValue = string | number | boolean | null | undefined;

export interface SqliteQueryResult<T = SqliteRow> {
  rows: T[];
  lastInsertRowId?: bigint;
}

type Promiser = Awaited<ReturnType<typeof sqlite3Worker1Promiser>>;

type LoosePromiser = (type: string, args: unknown) => Promise<unknown>;

function extractResultRows<T>(response: unknown): T[] {
  const r = response as Record<string, unknown>;

  if (Array.isArray(r['resultRows'])) {
    return r['resultRows'] as T[];
  }

  const nestedResult = r['result'];
  if (nestedResult && typeof nestedResult === 'object' && Array.isArray((nestedResult as Record<string, unknown>)['resultRows'])) {
    return (nestedResult as Record<string, unknown>)['resultRows'] as T[];
  }

  return [];
}

function extractLastInsertRowId(response: unknown): bigint | undefined {
  const r = response as Record<string, unknown>;

  const topLevel = r['lastInsertRowId'];
  if (typeof topLevel === 'bigint') {
    return topLevel;
  }

  const nestedResult = r['result'];
  if (nestedResult && typeof nestedResult === 'object') {
    const nested = (nestedResult as Record<string, unknown>)['lastInsertRowId'];
    if (typeof nested === 'bigint') {
      return nested;
    }
  }

  return undefined;
}

@Injectable({ providedIn: 'root' })
export class SqliteDatabaseService {
  private readonly zone = inject(NgZone);

  private promiser: Promiser | null = null;
  private initializing: Promise<void> | null = null;

  readonly changes$ = new BehaviorSubject<string>('init');

  async initialize(): Promise<void> {
    if (this.promiser) {
      return;
    }

    if (this.initializing) {
      await this.initializing;
      return;
    }

    this.initializing = this.doInitialize();
    await this.initializing;
  }

  private async doInitialize(): Promise<void> {
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers are not available in this environment.');
    }

    this.promiser = await sqlite3Worker1Promiser({
      worker: () => new Worker('/assets/sqlite-wasm/sqlite3-worker1.mjs', { type: 'module' }),
      onready: async (promiser) => {
        await promiser('open', {
          filename: DB_FILENAME,
          vfs: 'opfs',
        });
      },
    });

    await this.exec({
      sql: `CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER PRIMARY KEY);`,
    });

    await this.exec({ sql: CREATE_SCHEMA_SQL });
  }

  async exec<T = SqliteRow>(options: SqliteExecOptions): Promise<SqliteQueryResult<T>> {
    await this.initialize();

    const execArgs = {
      sql: options.sql,
      bind: options.bind,
      rowMode: 'object',
      returnValue: 'resultRows',
      lastInsertRowId: options.lastInsertRowId,
    };

    const rawResponse = await (this.promiser as unknown as LoosePromiser)('exec', execArgs);

    return {
      rows: extractResultRows<T>(rawResponse),
      lastInsertRowId: extractLastInsertRowId(rawResponse),
    };
  }

  async execMany(statements: SqliteExecOptions[]): Promise<void> {
    await this.initialize();

    for (const statement of statements) {
      await this.exec(statement);
    }
  }

  async transaction(steps: () => Promise<unknown>): Promise<void> {
    await this.initialize();

    await this.exec({ sql: 'BEGIN TRANSACTION;' });
    try {
      await steps();
      await this.exec({ sql: 'COMMIT;' });
    } catch (error) {
      await this.exec({ sql: 'ROLLBACK;' });
      throw error;
    }
  }

  notifyChange(table: string): void {
    this.zone.run(() => this.changes$.next(table));
  }

  waitForChange$(table?: string): Promise<void> {
    return firstValueFrom(
      this.changes$.pipe(
        filter((changed) => (table ? changed === table : true)),
        take(1),
      ),
    ).then(() => undefined);
  }
}
